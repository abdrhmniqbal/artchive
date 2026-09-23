import { z } from "zod";
import { isPasswordCompromised } from "better-auth/plugins/haveibeenpwned";
import { isUsernameAllowed } from "./username-policy";
import { and, desc, eq, like, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";;
import { createServerFn } from "@tanstack/react-start";
import { clientIpHash, getServerContext, getHeaders, getSessionUser, rateLimit, toPublicUser } from "./server";
import { getRequest } from "@tanstack/react-start/server";
import * as schema from "@/lib/db/schema";

const id = () => crypto.randomUUID();

/** Throttle per-user write actions; throws on abuse. */
async function requireRate(action: string, userId: string, opts?: { tight?: boolean }) {
  const ok = await rateLimit(`${action}:${userId}`, opts);
  if (!ok) throw new Error("Too many requests. Slow down a little.");
}

const INTERACTION_WEIGHTS = { view: 0.5, like: 3, save: 5, comment: 4, follow: 2 } as const;

/** Bump a user's affinity for a muse/tag. */
async function bumpPreference(userId: string, kind: "muse" | "tag", key: string, weight: number) {
  const { db } = await getServerContext();
  await db
    .insert(schema.userPreference)
    .values({ userId, kind, key, score: weight, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.userPreference.userId, schema.userPreference.kind, schema.userPreference.key],
      set: { score: sql`score + ${weight}`.mapWith(Number), updatedAt: new Date() },
    });
}

/** Record all muse/tag affinities triggered by interacting with a pin. */
async function recordPinInteraction(userId: string, pinId: string, kind: keyof typeof INTERACTION_WEIGHTS) {
  const { db } = await getServerContext();
  const weight = INTERACTION_WEIGHTS[kind];
  const muses = await db
    .select({ id: schema.pinMuse.museId })
    .from(schema.pinMuse)
    .where(eq(schema.pinMuse.pinId, pinId));
  for (const m of muses) await bumpPreference(userId, "muse", m.id, weight);
  const [pin] = await db.select({ tags: schema.pin.tags }).from(schema.pin).where(eq(schema.pin.id, pinId)).limit(1);
  for (const tag of pin?.tags ?? []) await bumpPreference(userId, "tag", tag, weight);
}

/* ---------------------------------- auth ---------------------------------- */

export const signup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      username: z
        .string()
        .min(3)
        .max(30)
        .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscore only")
        .refine(isUsernameAllowed, "This username is reserved. Try another one."),
    }),
  )
  .handler(async ({ data }) => {
    const iph = clientIpHash(await getHeaders());
    if (!(await rateLimit(`signup:${iph}`, { tight: true }))) throw new Error("Too many signups from this network. Try later.");
    if (await isPasswordCompromised(data.password)) throw new Error("PASSWORD_COMPROMISED");
    const { auth } = await getServerContext();
    const res = await auth.api.signUpEmail({
      body: { email: data.email, password: data.password, name: data.name, username: data.username },
      headers: getRequest().headers,
      asResponse: true,
    });
    if (!res.ok) {
      // generic message: don't reveal whether email/username is taken (enumeration)
      throw new Error("Cannot create account with those details.");
    }
    const cookies = res.headers.getSetCookie();
    return new Response(null, { status: 200, headers: cookies.length ? { "set-cookie": cookies.join(", ") } : undefined });
  });

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ identity: z.string().min(1), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { auth } = await getServerContext();
    const useEmail = data.identity.includes("@");
    const res = useEmail
      ? await auth.api.signInEmail({
          body: { email: data.identity, password: data.password },
          headers: getRequest().headers,
          asResponse: true,
        })
      : await auth.api.signInUsername({
          body: { username: data.identity, password: data.password },
          headers: getRequest().headers,
          asResponse: true,
        });
    if (!res.ok) {
      if (res.status === 403) throw new Error("VERIFY_REQUIRED");
      throw new Error("Invalid credentials");
    }
    const cookies = res.headers.getSetCookie();
    return new Response(null, { status: 200, headers: cookies.length ? { "set-cookie": cookies.join(", ") } : undefined });
  });

export const resendVerification = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const iph = clientIpHash(await getHeaders());
    if (!(await rateLimit(`verify:${iph}`, { tight: true }))) throw new Error("Too many requests. Try again later.");
    const { auth } = await getServerContext();
    await auth.api.sendVerificationEmail({ body: { email: data.email } });
    return { ok: true };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const iph = clientIpHash(await getHeaders());
    if (!(await rateLimit(`reset:${iph}`, { tight: true }))) throw new Error("Too many requests. Try again later.");
    const { auth } = await getServerContext();
    await auth.api.requestPasswordReset({ body: { email: data.email, redirectTo: "/reset-password" } });
    // generic response either way: never reveal whether the email exists
    return { ok: true };
  });

export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(1), newPassword: z.string().min(8) }))
  .handler(async ({ data }) => {
    const iph = clientIpHash(await getHeaders());
    if (!(await rateLimit(`reset:${iph}`, { tight: true }))) throw new Error("Too many requests. Try again later.");
    if (await isPasswordCompromised(data.newPassword)) throw new Error("PASSWORD_COMPROMISED");
    const { auth } = await getServerContext();
    const res = await auth.api.resetPassword({
      body: { newPassword: data.newPassword, token: data.token },
      asResponse: true,
    });
    if (!res.ok) throw new Error("This reset link is invalid or expired. Request a new one.");
    return { ok: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Not signed in.");
    await requireRate("password", user.id, { tight: true });
    if (await isPasswordCompromised(data.newPassword)) throw new Error("PASSWORD_COMPROMISED");
    const { auth } = await getServerContext();
    const res = await auth.api.changePassword({
      body: { currentPassword: data.currentPassword, newPassword: data.newPassword, revokeOtherSessions: true },
      headers: getRequest().headers,
      asResponse: true,
    });
    if (!res.ok) throw new Error("Current password is incorrect.");
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1).optional(), confirmUsername: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Not signed in.");
    if (data.confirmUsername.trim().toLowerCase() !== (user.username ?? "").toLowerCase()) {
      throw new Error("Type your username exactly to confirm.");
    }
    await requireRate("delete", user.id, { tight: true });
    const { auth } = await getServerContext();
    const res = await auth.api.deleteUser({
      body: data.password ? { password: data.password } : {},
      headers: getRequest().headers,
      asResponse: true,
    });
    if (!res.ok) throw new Error("Could not delete your account. Check your password and try again.");
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { auth } = await getServerContext();
  const res = await auth.api.signOut({ headers: getRequest().headers, asResponse: true });
  const cookies = res.headers.getSetCookie();
  return new Response(null, { status: 200, headers: cookies.length ? { "set-cookie": cookies.join(", ") } : undefined });
});

/** Which social providers are configured (booleans only, never secrets). */
export const authProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await getServerContext();
  return { google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) };
});

/** Begin Google OAuth: returns the Google URL for a full-page redirect. */
export const startGoogleSignIn = createServerFn({ method: "POST" }).handler(async () => {
  const iph = clientIpHash(await getHeaders());
  if (!(await rateLimit(`oauth:${iph}`, { tight: true }))) throw new Error("Too many requests. Try again later.");
  const { auth, env } = await getServerContext();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error("Google sign-in is not configured.");
  const res = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: "/",
      newUserCallbackURL: "/welcome",
      disableRedirect: true,
    },
  });
  const url = (res as unknown as { url?: string }).url;
  if (!url) throw new Error("Could not start Google sign-in. Try again.");
  return { url };
});

/** Claim a username for OAuth users who signed up without one. One shot. */
export const claimUsername = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z
        .string()
        .min(3)
        .max(30)
        .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, underscore only")
        .refine(isUsernameAllowed, "This username is reserved. Try another one."),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Not signed in.");
    if (user.username) throw new Error("Username is already set.");
    await requireRate("username", user.id, { tight: true });
    const username = data.username.toLowerCase();
    const { db } = await getServerContext();
    const [taken] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.username, username)).limit(1);
    if (taken) throw new Error("That username is taken. Try another one.");
    await db.update(schema.user).set({ username }).where(eq(schema.user.id, user.id));
    return { ok: true };
  });

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  return user
    ? { ...toPublicUser(user), email: user.email, emailVerified: user.emailVerified, role: user.role, showNsfw: user.showNsfw }
    : null;
});

/* ---------------------------------- pins ---------------------------------- */

export const getFeed = createServerFn({ method: "GET" })
  .validator(z.object({ museSlug: z.string().optional(), userId: z.string().optional(), sort: z.string().optional(), q: z.string().optional(), tag: z.string().optional(), cursor: z.number().int().min(0).optional(), ids: z.array(z.string()).max(500).optional() }))
  .handler(async ({ data }) => {
    const { db } = await getServerContext();
    const conditions = [];
    if (data.museSlug) {
      conditions.push(
        sql`p.id in (select pm.pin_id from pin_muse pm join muse m on m.id = pm.muse_id where m.slug = ${data.museSlug})`,
      );
    }
    if (data.ids) {
      if (data.ids.length === 0) return [];
      conditions.push(sql`p.id in (${sql.join(data.ids.map((id) => sql`${id}`), sql`, `)})`);
    }
    if (data.userId) conditions.push(sql`p.user_id = ${data.userId}`);
    if (data.q && data.q.trim()) {
      const like = `%${data.q.trim()}%`;
      conditions.push(sql`(p.title like ${like} or p.description like ${like} or coalesce(p.tags, '[]') like ${like} or p.id in (select pm.pin_id from pin_muse pm join muse m on m.id = pm.muse_id where m.name like ${like}))`);
    }
    if (data.tag && data.tag.trim()) {
      const tag = data.tag.trim();
      conditions.push(sql`exists (select 1 from json_each(coalesce(p.tags, '[]')) je where lower(je.value) = lower(${tag}))`);
    }

    // "for you": personalized ranking from tracked interactions (muse/tag affinity)
    let meUser: typeof schema.user.$inferSelect | null = null;
    if (data.sort === "foryou") meUser = await getSessionUser();
    let affinityScores: Record<string, number> = {};
    if (meUser) {
      const prefs = await db
        .select({ kind: schema.userPreference.kind, key: schema.userPreference.key, score: schema.userPreference.score })
        .from(schema.userPreference)
        .where(eq(schema.userPreference.userId, meUser.id))
        .orderBy(desc(schema.userPreference.score))
        .limit(200);
      for (const p of prefs) affinityScores[`${p.kind}:${p.key}`] = p.score;
    }

    if (data.sort === "following") {
      const me = await getSessionUser();
      if (!me) return []; // getFeed returns a flat array
      conditions.push(sql`p.user_id in (select following_id from "follow" where follower_id = ${me.id})`);
    }
    if (data.sort !== "foryou") {
      conditions.push(sql`1=1`);
    }

    // beta: NSFW pins hidden unless an admin opted in via settings
    if (!data.ids) {
      const viewer = await getSessionUser();
      const showNsfw = !!viewer && viewer.role === "admin" && viewer.showNsfw;
      if (!showNsfw) conditions.push(sql`p.is_nsfw = 0`);
    }
    const rows = await db.all<{ [k: string]: unknown }>(sql`
      select p.id, p.title, p.description, p.image_url as imageUrl, p.width, p.height, p.created_at as createdAt,
        u.name as userName, u.username as userUsername, u.image as userImage,
        p.is_nsfw as isNsfw,
        (select count(*) from "like" l where l.pin_id = p.id) as likeCount,
        coalesce(p.tags, '[]') as tags,
        (select count(*) from comment c where c.pin_id = p.id) as commentCount,
        coalesce((select group_concat(m.id) from pin_muse pm join muse m on m.id = pm.muse_id where pm.pin_id = p.id), '') as museIds,
        coalesce((select group_concat(m.id || ',' || m.name || ',' || coalesce((
          select p2.image_url from pin_muse pm2 join pin p2 on p2.id = pm2.pin_id
          where pm2.muse_id = m.id
          order by (select count(*) from "like" l2 where l2.pin_id = p2.id) desc limit 1
        ), '') || ',' || m.slug, '||') from pin_muse pm join muse m on m.id = pm.muse_id where pm.pin_id = p.id), '') as museTriples
      from pin p join user u on u.id = p.user_id
      ${conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``}
      order by p.created_at desc
      limit ${data.ids ? Math.max(data.ids.length, 40) : 40} offset ${data.cursor ?? 0}
    `);
    const feedUser = meUser;
    let myLikes: string[] = [];
    let mySaves: string[] = [];
    if (feedUser) {
      const likes = await db.all<{ pin_id: string }>(sql`select pin_id from "like" where user_id = ${feedUser.id}`);
      myLikes = likes.map((l) => l.pin_id);
      const saves = await db.all<{ pin_id: string }>(sql`select distinct cp.pin_id from collection_pin cp join collection c on c.id = cp.collection_id where c.user_id = ${feedUser.id}`);
      mySaves = saves.map((s) => s.pin_id);
    }
    const scored = rows.map((r) => {
      const museIds = String(r.museIds ?? "").split(",").filter(Boolean);
      let tagList: string[] = [];
      try {
        const parsed = typeof r.tags === "string" ? JSON.parse(r.tags as string) : r.tags;
        if (Array.isArray(parsed)) tagList = parsed as string[];
      } catch {
        tagList = [];
      }
      let affinity = 0;
      for (const mid of museIds) affinity += affinityScores[`muse:${mid}`] ?? 0;
      for (const t of tagList) affinity += affinityScores[`tag:${t}`] ?? 0;
      const ageHours = (Date.now() - new Date(r.createdAt as string).getTime()) / 3_600_000;
      const engagement = Number(r.likeCount ?? 0) * 2 + 1;
      const score = affinity * 10 + engagement / (1 + ageHours / 72);
      return { r, score };
    });
    if (data.sort === "foryou" && meUser) scored.sort((a, b) => b.score - a.score);
    const ordered = scored.map((s) => s.r);
    return ordered.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      description: (r.description as string | null) ?? "",
      imageUrl: r.imageUrl as string,
      width: (r.width as number | null) ?? 0,
      height: (r.height as number | null) ?? 0,
      createdAt: r.createdAt as string,
      user: { name: r.userName as string, username: r.userUsername as string, image: (r.userImage as string | null) ?? null },
      likeCount: Number(r.likeCount ?? 0),
      commentCount: Number(r.commentCount ?? 0),
      isNsfw: Number(r.isNsfw ?? 0) === 1,
      liked: myLikes.includes(r.id as string),
      saved: mySaves.includes(r.id as string),
      tags: (() => {
        try {
          const parsed = typeof r.tags === "string" ? JSON.parse(r.tags as string) : r.tags;
          return Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
          return [] as string[];
        }
      })(),
      muses: String(r.museTriples ?? "")
        .split("||")
        .filter(Boolean)
        .map((triple) => {
          const parts = triple.split(",");
          const [mid, name] = parts;
          const featured = parts[2] || "";
          const slug = parts[3] || "";
          return { id: mid, name, featuredImage: featured || null, slug };
        }),
    }));
  });

export type FeedPin = Awaited<ReturnType<typeof getFeed>>[number];

export const getPin = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: pinId }) => {
    const { db } = await getServerContext();
    const [pin] = await db.select().from(schema.pin).where(eq(schema.pin.id, pinId)).limit(1);
    if (!pin) return null;
    const [owner] = await db.select().from(schema.user).where(eq(schema.user.id, pin.userId)).limit(1);
    const tagged = await db
      .select({
        id: schema.muse.id,
        name: schema.muse.name,
        slug: schema.muse.slug,
        avatarUrl: schema.muse.avatarUrl,
        featuredImage: sql<string | null>`coalesce((
          select p2.image_url from pin_muse pm2 join pin p2 on p2.id = pm2.pin_id
          where pm2.muse_id = ${schema.muse.id}
          order by (select count(*) from "like" l2 where l2.pin_id = p2.id) desc
          limit 1
        ), null)`,
      })
      .from(schema.pinMuse)
      .innerJoin(schema.muse, eq(schema.muse.id, schema.pinMuse.museId))
      .where(eq(schema.pinMuse.pinId, pinId));
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(schema.like)
      .where(eq(schema.like.pinId, pinId));
    const meUser = await getSessionUser();
    let liked = false;
    let savedCollections: { id: string; name: string }[] = [];
    if (meUser) {
      const [l] = await db
        .select()
        .from(schema.like)
        .where(and(eq(schema.like.userId, meUser.id), eq(schema.like.pinId, pinId)))
        .limit(1);
      liked = !!l;
      savedCollections = await db
        .select({ id: schema.collection.id, name: schema.collection.name })
        .from(schema.collection)
        .leftJoin(
          schema.collectionPin,
          and(eq(schema.collectionPin.collectionId, schema.collection.id), eq(schema.collectionPin.pinId, pinId)),
        )
        .where(and(eq(schema.collection.userId, meUser.id), sql`${schema.collectionPin.pinId} is null`));
    }
    return {
      pin,
      user: owner ? toPublicUser(owner) : null,
      muses: tagged,
      likeCount: Number(cnt),
      liked,
      savedCollections,
    };
  });

type Db = Awaited<ReturnType<typeof getServerContext>>["db"];

/** Resolve muse names by slug or create them on the fly, then link to the pin. */
async function syncPinMuses(db: Db, pinId: string, tags: string[], userId: string) {
  for (const tag of tags) {
    const slug = tag.toLowerCase().trim().replace(/\s+/g, "-");
    let [m] = await db.select().from(schema.muse).where(eq(schema.muse.slug, slug)).limit(1);
    if (!m) {
      [m] = await db
        .select()
        .from(schema.muse)
        .where(sql`lower(${schema.muse.name}) = ${tag.toLowerCase().trim()}`)
        .limit(1);
    }
    if (!m) {
      [m] = await db
        .insert(schema.muse)
        .values({ id: id(), slug, name: tag.trim(), createdBy: userId })
        .returning();
    }
    await db.insert(schema.pinMuse).values({ pinId, museId: m.id }).onConflictDoNothing();
  }
}

export const createPin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      imageUrl: z.string().url(),
      width: z.number().optional(),
      height: z.number().optional(),
      sourceUrl: z.string().url().optional().or(z.literal("")),
      museTags: z.array(z.string()).max(8).default([]),
      tags: z.array(z.string()).max(12).default([]),
      collectionId: z.string().optional(),
      isNsfw: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    requireRate("pin", user.id);
    if (data.isNsfw && user.role !== "admin") throw new Error("Mark as NSFW is admin-only (beta)");
    const { db } = await getServerContext();
    const pinId = id();
    await db.insert(schema.pin).values({
      id: pinId,
      title: data.title,
      description: data.description ?? null,
      imageUrl: data.imageUrl,
      width: data.width ?? null,
      height: data.height ?? null,
      sourceUrl: data.sourceUrl || null,
      tags: data.tags.length ? data.tags : null,
      isNsfw: data.isNsfw ?? false,
      userId: user.id,
    });
    // resolve muse tags by slug or create new muses on the fly
    await syncPinMuses(db, pinId, data.museTags, user.id);
    if (data.collectionId) {
      const [c] = await db
        .select()
        .from(schema.collection)
        .where(and(eq(schema.collection.id, data.collectionId), eq(schema.collection.userId, user.id)))
        .limit(1);
      if (c) await db.insert(schema.collectionPin).values({ collectionId: c.id, pinId }).onConflictDoNothing();
    }
    return { id: pinId };
  });

export const deletePin = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: pinId }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    await db.delete(schema.pin).where(and(eq(schema.pin.id, pinId), eq(schema.pin.userId, user.id)));
    return { ok: true };
  });

export const updatePin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      sourceUrl: z.string().url().optional().or(z.literal("")),
      tags: z.array(z.string()).max(12).default([]),
      museTags: z.array(z.string()).max(8).default([]),
      isNsfw: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    if (data.isNsfw !== undefined && user.role !== "admin") throw new Error("Mark as NSFW is admin-only (beta)");
    const { db } = await getServerContext();
    const res = await db
      .update(schema.pin)
      .set({
        title: data.title,
        description: data.description ?? null,
        sourceUrl: data.sourceUrl || null,
        tags: data.tags.length ? data.tags : null,
        ...(data.isNsfw !== undefined ? { isNsfw: data.isNsfw } : {}),
      })
      .where(and(eq(schema.pin.id, data.id), eq(schema.pin.userId, user.id)))
      .returning({ id: schema.pin.id });
    if (!res.length) throw new Error("Pin not found or not yours");
    await db.delete(schema.pinMuse).where(eq(schema.pinMuse.pinId, data.id));
    await syncPinMuses(db, data.id, data.museTags, user.id);
    return { ok: true };
  });

/* --------------------------------- muses ---------------------------------- */

export const searchMuses = createServerFn({ method: "GET" })
  .validator(z.string().optional())
  .handler(async ({ data: q }) => {
    const { db } = await getServerContext();
    if (!q) return db.select({ id: schema.muse.id, name: schema.muse.name, slug: schema.muse.slug }).from(schema.muse).limit(8);
    return db
      .select({ id: schema.muse.id, name: schema.muse.name, slug: schema.muse.slug })
      .from(schema.muse)
      .where(or(like(sql`lower(${schema.muse.name})`, `%${q.toLowerCase()}%`), like(schema.muse.slug, `%${q.toLowerCase()}%`)))
      .limit(8);
  });

async function viewerShowsNsfw() {
  const viewer = await getSessionUser();
  return !!viewer && viewer.role === "admin" && viewer.showNsfw;
}

export const getMuse = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: slug }) => {
    const { db } = await getServerContext();
    const [muse] = await db.select().from(schema.muse).where(eq(schema.muse.slug, slug)).limit(1);
    if (!muse) return null;
    const showNsfw = await viewerShowsNsfw();
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(schema.pinMuse)
      .where(showNsfw ? eq(schema.pinMuse.museId, muse.id) : and(eq(schema.pinMuse.museId, muse.id), sql`not exists (select 1 from pin p where p.id = ${schema.pinMuse.pinId} and p.is_nsfw = 1)`));
    const [featured] = await db
      .select({ imageUrl: schema.pin.imageUrl })
      .from(schema.pinMuse)
      .innerJoin(schema.pin, eq(schema.pin.id, schema.pinMuse.pinId))
      .where(showNsfw ? eq(schema.pinMuse.museId, muse.id) : and(eq(schema.pinMuse.museId, muse.id), eq(schema.pin.isNsfw, false)))
      .orderBy(desc(sql`(select count(*) from "like" l where l.pin_id = ${schema.pin.id})`))
      .limit(1);
    const topPins = await db
      .select({ id: schema.pin.id, title: schema.pin.title, imageUrl: schema.pin.imageUrl, width: schema.pin.width, height: schema.pin.height, likeCount: sql<number>`(select count(*) from "like" l where l.pin_id = ${schema.pin.id})` })
      .from(schema.pinMuse)
      .innerJoin(schema.pin, eq(schema.pin.id, schema.pinMuse.pinId))
      .where(showNsfw ? eq(schema.pinMuse.museId, muse.id) : and(eq(schema.pinMuse.museId, muse.id), eq(schema.pin.isNsfw, false)))
      .orderBy(desc(sql`(select count(*) from "like" l where l.pin_id = ${schema.pin.id})`))
      .limit(6);
    const boards = await db.all<{ [k: string]: unknown }>(sql`
      select c.id, c.name, u.username as ownerUsername,
        (select count(*) from collection_pin cp2 where cp2.collection_id = c.id) as pinCount,
        (select p2.image_url from collection_pin cp join pin p2 on p2.id = cp.pin_id
          where cp.collection_id = c.id and p2.id in (select pm2.pin_id from pin_muse pm2 where pm2.muse_id = ${muse.id})
          limit 1) as cover
      from collection c
      join user u on u.id = c.user_id
      where c.is_public = 1
        and exists (select 1 from collection_pin cp3 join pin_muse pm3 on pm3.pin_id = cp3.pin_id
                    where cp3.collection_id = c.id and pm3.muse_id = ${muse.id})
      order by pinCount desc limit 6
    `);
    const boardsOut = boards.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      ownerUsername: r.ownerUsername as string,
      pinCount: Number(r.pinCount ?? 0),
      cover: (r.cover as string) || null,
    }));
    return { muse, pinCount: Number(cnt), featuredImage: featured?.imageUrl ?? null, topPins, boards: boardsOut };
  });

export const getTopMuses = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await getServerContext();
  const rows = await db.all<{ [k: string]: unknown }>(sql`
    select m.id, m.name, m.slug,
      (select count(*) from pin_muse pm2 where pm2.muse_id = m.id) as pinCount,
      coalesce((
        select p2.image_url from pin_muse pm
        join pin p2 on p2.id = pm.pin_id
        where pm.muse_id = m.id
        order by (select count(*) from "like" l where l.pin_id = p2.id) desc
        limit 1
      ), '') as featuredImage
    from muse m
    order by pinCount desc
    limit 24
  `);
  const base = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    pinCount: Number(r.pinCount ?? 0),
    featuredImage: (r.featuredImage as string) || null,
    affinity: 0 as number,
  }));
  const me = await getSessionUser();
  if (!me) return base;
  // personalize: blend the user's own affinity with global popularity
  const prefs = await db
    .select({ key: schema.userPreference.key, score: schema.userPreference.score })
    .from(schema.userPreference)
    .where(and(eq(schema.userPreference.userId, me.id), eq(schema.userPreference.kind, "muse")))
    .limit(100);
  const aff = new Map(prefs.map((p) => [p.key, p.score]));
  for (const m of base) m.affinity = aff.get(m.id) ?? 0;
  const personalized = base.filter((m) => m.affinity > 0);
  if (personalized.length >= 3) {
    return personalized.sort((a, b) => b.affinity * 2 + b.pinCount * 0.1 - (a.affinity * 2 + a.pinCount * 0.1)).slice(0, 12);
  }
  // not enough signal — global order but promote any with affinity
  return base
    .sort((a, b) => (b.affinity > 0 ? 1 : 0) - (a.affinity > 0 ? 1 : 0) || b.pinCount - a.pinCount)
    .slice(0, 12);
});

/* ------------------------------- collections ------------------------------ */

export const myCollections = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  const { db } = await getServerContext();
  return db
    .select({
      id: schema.collection.id,
      name: schema.collection.name,
      description: schema.collection.description,
      pinCount: sql<number>`(select count(*) from collection_pin cp where cp.collection_id = ${schema.collection.id})`,
    })
    .from(schema.collection)
    .where(eq(schema.collection.userId, user.id))
    .orderBy(desc(schema.collection.createdAt));
});

export const updateMe = createServerFn({ method: "POST" })
  .validator(z.object({
    image: z.string().url().optional().or(z.literal("")),
    name: z.string().min(1).max(60).optional(),
    bio: z.string().max(200).optional(),
    showNsfw: z.boolean().optional(),
  }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const patch: Record<string, string | boolean | null> = {};
    if (data.image !== undefined) patch.image = data.image || null;
    if (data.name !== undefined && data.name.trim()) patch.name = data.name.trim();
    if (data.bio !== undefined) patch.bio = data.bio.trim() || null;
    if (data.showNsfw !== undefined) {
      if (user.role !== "admin") throw new Error("NSFW visibility is admin-only (beta)");
      patch.showNsfw = data.showNsfw;
    }
    if (!Object.keys(patch).length) return { ok: true };
    await db.update(schema.user).set(patch).where(eq(schema.user.id, user.id));
    return { ok: true };
  });

export const createCollection = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1).max(80), description: z.string().optional() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    requireRate("collection", user.id);
    const { db } = await getServerContext();
    const [c] = await db
      .insert(schema.collection)
      .values({ id: id(), name: data.name, description: data.description ?? null, userId: user.id })
      .returning();
    return c;
  });

export const saveToCollection = createServerFn({ method: "POST" })
  .validator(z.object({ collectionId: z.string(), pinId: z.string() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    requireRate("save", user.id);
    const { db } = await getServerContext();
    const access = await collectionAccess(db, data.collectionId, user.id);
    if (!access || access.role !== "owner" && access.role !== "editor") throw new Error("Collection not found");
    await db.insert(schema.collectionPin).values(data).onConflictDoNothing();
    await recordPinInteraction(user.id, data.pinId, "save");
    return { ok: true };
  });

export const getCollection = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: collectionId }) => {
    const { db } = await getServerContext();
    const [c] = await db.select().from(schema.collection).where(eq(schema.collection.id, collectionId)).limit(1);
    if (!c) return null;
    const user = await getSessionUser();
    if (!c.isPublic) {
      const access = user ? await collectionAccess(db, collectionId, user.id) : null;
      if (!access || access.role === null) return null; // private boards are invisible to non-collaborators
    }
    const pins = await db
      .select({
        id: schema.pin.id,
        title: schema.pin.title,
        description: schema.pin.description,
        imageUrl: schema.pin.imageUrl,
        width: schema.pin.width,
        height: schema.pin.height,
        createdAt: schema.pin.createdAt,
        isPinned: schema.collectionPin.isPinned,
        user: { name: schema.user.name, username: schema.user.username, image: schema.user.image },
        likeCount: sql<number>`(select count(*) from "like" l where l.pin_id = ${schema.pin.id})`,
        commentCount: sql<number>`(select count(*) from comment c2 where c2.pin_id = ${schema.pin.id})`,
        liked: sql<number>`exists (select 1 from "like" l2 where l2.pin_id = ${schema.pin.id} and l2.user_id = ${user?.id ?? null})`,
        saved: sql<number>`exists (select 1 from collection_pin cp2 join collection c3 on c3.id = cp2.collection_id where cp2.pin_id = ${schema.pin.id} and c3.user_id = ${user?.id ?? null})`,
        muses: sql<string>`(select coalesce(json_group_array(json_object('id', m.id, 'name', m.name, 'slug', m.slug, 'avatarUrl', m.avatar_url, 'featuredImage', coalesce((select p2.image_url from pin_muse pm2 join pin p2 on p2.id = pm2.pin_id where pm2.muse_id = m.id order by (select count(*) from "like" l3 where l3.pin_id = p2.id) desc limit 1), null))), json_array()) from pin_muse pm join muse m on m.id = pm.muse_id where pm.pin_id = ${schema.pin.id})`,
      })
      .from(schema.collectionPin)
      .innerJoin(schema.pin, eq(schema.pin.id, schema.collectionPin.pinId))
      .innerJoin(schema.user, eq(schema.user.id, schema.pin.userId))
      .where(eq(schema.collectionPin.collectionId, collectionId))
      .orderBy(desc(schema.collectionPin.isPinned), desc(schema.collectionPin.addedAt));
    const normalized = pins.map((p) => ({
      ...p,
      likeCount: Number(p.likeCount ?? 0),
      commentCount: Number(p.commentCount ?? 0),
      liked: !!p.liked,
      saved: !!p.saved,
      muses: typeof p.muses === "string" ? JSON.parse(p.muses) : (p.muses ?? []),
    }));
    return { collection: c, pins: normalized };
  });

/* --------------------------------- socials -------------------------------- */

async function notify(input: { userId: string; actorId: string; type: string; pinId?: string; commentId?: string }) {
  if (input.userId === input.actorId) return; // never notify yourself
  const { db } = await getServerContext();
  await db.insert(schema.notification).values({ id: id(), ...input }).onConflictDoNothing();
}

export const toggleLike = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: pinId }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const [existing] = await db
      .select()
      .from(schema.like)
      .where(and(eq(schema.like.userId, user.id), eq(schema.like.pinId, pinId)))
      .limit(1);
    if (existing) {
      await db.delete(schema.like).where(and(eq(schema.like.userId, user.id), eq(schema.like.pinId, pinId)));
      return { liked: false };
    }
    await db.insert(schema.like).values({ userId: user.id, pinId }).onConflictDoNothing();
    await recordPinInteraction(user.id, pinId, "like");
    const [pinOwner] = await db.select({ userId: schema.pin.userId }).from(schema.pin).where(eq(schema.pin.id, pinId)).limit(1);
    if (pinOwner) await notify({ userId: pinOwner.userId, actorId: user.id, type: "like", pinId });
    return { liked: true };
  });

export const editComment = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), body: z.string().min(1).max(1000) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const res = await db
      .update(schema.comment)
      .set({ body: data.body })
      .where(and(eq(schema.comment.id, data.id), eq(schema.comment.userId, user.id)))
      .returning({ id: schema.comment.id });
    if (!res.length) throw new Error("Comment not found or not yours");
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: commentId }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const res = await db
      .delete(schema.comment)
      .where(and(eq(schema.comment.id, commentId), eq(schema.comment.userId, user.id)))
      .returning({ id: schema.comment.id });
    if (!res.length) throw new Error("Comment not found or not yours");
    return { ok: true };
  });

export const getComments = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: pinId }) => {
    const { db } = await getServerContext();
    const meUser = await getSessionUser();
    const rows = await db
      .select({
        id: schema.comment.id,
        body: schema.comment.body,
        parentId: schema.comment.parentId,
        createdAt: schema.comment.createdAt,
        userId: schema.user.id,
        userName: schema.user.name,
        userUsername: schema.user.username,
        userImage: schema.user.image,
        likeCount: sql<number>`(select count(*) from comment_like cl where cl.comment_id = ${schema.comment.id})`,
        likedByMe: meUser
          ? sql<boolean>`exists (select 1 from comment_like cl where cl.comment_id = ${schema.comment.id} and cl.user_id = ${meUser.id})`
          : sql<boolean>`false`,
      })
      .from(schema.comment)
      .innerJoin(schema.user, eq(schema.user.id, schema.comment.userId))
      .where(eq(schema.comment.pinId, pinId))
      .orderBy(schema.comment.createdAt)
      .limit(200);
    return rows.map((r) => ({ ...r, likeCount: Number(r.likeCount) }));
  });

export const addComment = createServerFn({ method: "POST" })
  .validator(z.object({ pinId: z.string(), body: z.string().min(1).max(1000), parentId: z.string().optional() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    requireRate("comment", user.id);
    const { db } = await getServerContext();
    if (data.parentId) {
      const [parent] = await db.select().from(schema.comment).where(eq(schema.comment.id, data.parentId)).limit(1);
      if (!parent || parent.pinId !== data.pinId) throw new Error("Invalid parent comment");
    }
    await db.insert(schema.comment).values({ id: id(), pinId: data.pinId, userId: user.id, body: data.body, parentId: data.parentId ?? null });
    await recordPinInteraction(user.id, data.pinId, "comment");
    return { ok: true };
  });

export const toggleCommentLike = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: commentId }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const [target] = await db.select({ id: schema.comment.id }).from(schema.comment).where(eq(schema.comment.id, commentId)).limit(1);
    if (!target) throw new Error("Comment not found");
    const [existing] = await db
      .select()
      .from(schema.commentLike)
      .where(and(eq(schema.commentLike.userId, user.id), eq(schema.commentLike.commentId, commentId)))
      .limit(1);
    if (existing) {
      await db
        .delete(schema.commentLike)
        .where(and(eq(schema.commentLike.userId, user.id), eq(schema.commentLike.commentId, commentId)));
      return { liked: false };
    }
    await db.insert(schema.commentLike).values({ userId: user.id, commentId }).onConflictDoNothing();
    return { liked: true };
  });

export const updateCollection = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), name: z.string().min(1), description: z.string().optional(), isPublic: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const res = await db
      .update(schema.collection)
      .set({ name: data.name, description: data.description ?? null, ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}) })
      .where(and(eq(schema.collection.id, data.id), eq(schema.collection.userId, user.id)))
      .returning({ id: schema.collection.id });
    if (!res.length) throw new Error("Board not found or not yours");
    return { ok: true };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    // collection_pin rows cascade via FK
    const res = await db.delete(schema.collection).where(and(eq(schema.collection.id, id), eq(schema.collection.userId, user.id))).returning({ id: schema.collection.id });
    if (!res.length) throw new Error("Board not found or not yours");
    return { ok: true };
  });

async function collectionAccess(db: any, collectionId: string, userId: string) {
  const [c] = await db.select().from(schema.collection).where(eq(schema.collection.id, collectionId)).limit(1);
  if (!c) return null;
  const [collab] = await db
    .select({ role: schema.collectionCollaborator.role })
    .from(schema.collectionCollaborator)
    .where(and(eq(schema.collectionCollaborator.collectionId, collectionId), eq(schema.collectionCollaborator.userId, userId)))
    .limit(1);
  const isOwner = c.userId === userId;
  const role = isOwner ? "owner" : collab ? collab.role : null;
  return { c, isOwner, role };
}

export const inviteCollaborator = createServerFn({ method: "POST" })
  .validator(z.object({ collectionId: z.string(), username: z.string().min(1) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const [c] = await db.select().from(schema.collection).where(eq(schema.collection.id, data.collectionId)).limit(1);
    if (!c || c.userId !== user.id) throw new Error("Only the board owner can invite");
    const [target] = await db.select().from(schema.user).where(eq(schema.user.username, data.username.trim().replace(/^@/, ""))).limit(1);
    if (!target) throw new Error("User not found");
    if (target.id === user.id) throw new Error("You already own this board");
    await db.insert(schema.collectionCollaborator).values({ collectionId: data.collectionId, userId: target.id, role: "editor" }).onConflictDoNothing();
    await notify({ userId: target.id, actorId: user.id, type: "collab_invite", pinId: c.id });
    return { ok: true, name: target.name };
  });

export const removeCollaborator = createServerFn({ method: "POST" })
  .validator(z.object({ collectionId: z.string(), username: z.string() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const [c] = await db.select().from(schema.collection).where(eq(schema.collection.id, data.collectionId)).limit(1);
    if (!c || c.userId !== user.id) throw new Error("Only the board owner can remove");
    const [target] = await db.select().from(schema.user).where(eq(schema.user.username, data.username.trim().replace(/^@/, ""))).limit(1);
    if (!target) throw new Error("User not found");
    await db.delete(schema.collectionCollaborator).where(and(eq(schema.collectionCollaborator.collectionId, data.collectionId), eq(schema.collectionCollaborator.userId, target.id)));
    return { ok: true };
  });

export const getCollaborators = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: collectionId }) => {
    const { db } = await getServerContext();
    return db
      .select({ username: schema.user.username, name: schema.user.name, image: schema.user.image, role: schema.collectionCollaborator.role })
      .from(schema.collectionCollaborator)
      .innerJoin(schema.user, eq(schema.user.id, schema.collectionCollaborator.userId))
      .where(eq(schema.collectionCollaborator.collectionId, collectionId));
  });

export const getCollectionMeta = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const { db } = await getServerContext();
    const user = await getSessionUser();
    const [c] = await db.select().from(schema.collection).where(eq(schema.collection.id, id)).limit(1);
    if (!c) return null;
    // owner check for edit UI; hide private boards from others
    if (!c.isPublic) {
      if (!user || user.id !== c.userId) return null;
    }
    return { id: c.id, name: c.name, description: c.description, isPublic: c.isPublic, isOwner: !!user && user.id === c.userId, ownerId: c.userId };
  });

export const togglePinned = createServerFn({ method: "POST" })
  .validator(z.object({ collectionId: z.string(), pinId: z.string(), pinned: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const access = await collectionAccess(db, data.collectionId, user.id);
    if (!access || access.role !== "owner" && access.role !== "editor") throw new Error("Collection not found");
    if (data.pinned) {
      // only one pinned pin per board
      await db.update(schema.collectionPin).set({ isPinned: false }).where(eq(schema.collectionPin.collectionId, data.collectionId));
    }
    await db
      .update(schema.collectionPin)
      .set({ isPinned: data.pinned })
      .where(and(eq(schema.collectionPin.collectionId, data.collectionId), eq(schema.collectionPin.pinId, data.pinId)));
    return { ok: true };
  });

export const removeFromCollection = createServerFn({ method: "POST" })
  .validator(z.object({ collectionId: z.string(), pinId: z.string() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const [c] = await db
      .select()
      .from(schema.collection)
      .where(and(eq(schema.collection.id, data.collectionId), eq(schema.collection.userId, user.id)))
      .limit(1);
    if (!c) throw new Error("Collection not found");
    await db
      .delete(schema.collectionPin)
      .where(and(eq(schema.collectionPin.collectionId, data.collectionId), eq(schema.collectionPin.pinId, data.pinId)));
    return { ok: true };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: targetUserId }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    if (user.id === targetUserId) throw new Error("Cannot follow yourself");
    const { db } = await getServerContext();
    const [target] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, targetUserId)).limit(1);
    if (!target) throw new Error("User not found");
    const [existing] = await db
      .select()
      .from(schema.follow)
      .where(and(eq(schema.follow.followerId, user.id), eq(schema.follow.followingId, targetUserId)))
      .limit(1);
    if (existing) {
      await db
        .delete(schema.follow)
        .where(and(eq(schema.follow.followerId, user.id), eq(schema.follow.followingId, targetUserId)));
      return { following: false };
    }
    await db.insert(schema.follow).values({ followerId: user.id, followingId: targetUserId }).onConflictDoNothing();
    await notify({ userId: targetUserId, actorId: user.id, type: "follow" });
    return { following: true };
  });

export const getNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  const { db } = await getServerContext();
  const rows = await db
    .select({
      id: schema.notification.id,
      type: schema.notification.type,
      pinId: schema.notification.pinId,
      read: schema.notification.read,
      createdAt: schema.notification.createdAt,
      actorName: schema.user.name,
      actorUsername: schema.user.username,
      actorImage: schema.user.image,
      pinTitle: schema.pin.title,
      pinImage: schema.pin.imageUrl,
    })
    .from(schema.notification)
    .innerJoin(schema.user, eq(schema.user.id, schema.notification.actorId))
    .leftJoin(schema.pin, eq(schema.pin.id, schema.notification.pinId))
    .where(eq(schema.notification.userId, user.id))
    .orderBy(desc(schema.notification.createdAt))
    .limit(50);
  return rows.map((r) => ({ ...r, unread: !r.read }));
});

export const markNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) throw new Error("Sign in required");
  const { db } = await getServerContext();
  await db.update(schema.notification).set({ read: true }).where(eq(schema.notification.userId, user.id));
  return { ok: true };
});

/* -------------------------------- profiles -------------------------------- */

export const getUserProfile = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: username }) => {
    const { db } = await getServerContext();
    const [u] = await db.select().from(schema.user).where(eq(schema.user.username, username)).limit(1);
    if (!u) return null;
    const [{ pins }] = await db
      .select({ pins: sql<number>`count(*)` })
      .from(schema.pin)
      .where(eq(schema.pin.userId, u.id));
    const [{ followers }] = await db
      .select({ followers: sql<number>`count(*)` })
      .from(schema.follow)
      .where(eq(schema.follow.followingId, u.id));
    const [{ following }] = await db
      .select({ following: sql<number>`count(*)` })
      .from(schema.follow)
      .where(eq(schema.follow.followerId, u.id));
    const meUser = await getSessionUser();
    let isFollowing = false;
    if (meUser) {
      const [f] = await db
        .select()
        .from(schema.follow)
        .where(and(eq(schema.follow.followerId, meUser.id), eq(schema.follow.followingId, u.id)))
        .limit(1);
      isFollowing = !!f;
    }
    return {
      user: toPublicUser(u),
      pinCount: Number(pins),
      followers: Number(followers),
      following: Number(following),
      isFollowing,
      isMe: meUser?.id === u.id,
    };
  });

export const getUserCollections = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: username }) => {
    const { db } = await getServerContext();
    const [u] = await db.select().from(schema.user).where(eq(schema.user.username, username)).limit(1);
    if (!u) return [];
    const me = await getSessionUser();
    const isSelf = me?.id === u.id;
    const withCounts = await db
      .select({
        id: schema.collection.id,
        name: schema.collection.name,
        description: schema.collection.description,
        isPublic: schema.collection.isPublic,
        pinCount: sql<number>`(select count(*) from collection_pin cp where cp.collection_id = ${schema.collection.id})`,
      })
      .from(schema.collection)
      .where(isSelf ? eq(schema.collection.userId, u.id) : and(eq(schema.collection.userId, u.id), eq(schema.collection.isPublic, true)));
    // D1 mishandles derived tables inside correlated subqueries, so covers are fetched separately
    const coverRows = await db.all<{ collection_id: string; covers: string }>(sql`
      select cp.collection_id, coalesce(group_concat(pin.image_url, '|'), '') as covers
      from collection_pin cp join pin on pin.id = cp.pin_id
      where cp.collection_id in (select id from collection where user_id = ${u.id})
      group by cp.collection_id
    `);
    const coverMap = new Map(coverRows.map((r) => [r.collection_id, r.covers ? r.covers.split("|") : []]));
    return withCounts.map((c) => ({ ...c, covers: coverMap.get(c.id) ?? [] }));
  });


export const getSuggestedTags = createServerFn({ method: "GET" })
  .validator(z.string().optional())
  .handler(async ({ data: prefix }) => {
    const { db } = await getServerContext();
    const rows = await db.select({ tags: schema.pin.tags }).from(schema.pin).limit(500);
    const counts = new Map<string, number>();
    for (const r of rows) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    const p = (prefix ?? "").trim().toLowerCase();
    return [...counts.entries()]
      .filter(([t]) => !p || t.toLowerCase().includes(p))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  });

export const getUserLikes = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(async ({ data: username }) => {
    const { db } = await getServerContext();
    const [u] = await db.select().from(schema.user).where(eq(schema.user.username, username)).limit(1);
    if (!u) return null;
    const me = await getSessionUser();
    // likes are private to their owner (Pinterest convention)
    if (!me || me.id !== u.id) return { private: true, pins: [] as Awaited<ReturnType<typeof getFeed>> };
    const likes = await db
      .select({ pinId: schema.like.pinId })
      .from(schema.like)
      .where(eq(schema.like.userId, u.id))
      .orderBy(desc(schema.like.createdAt))
      .limit(200);
    if (likes.length === 0) return { private: false, pins: [] as Awaited<ReturnType<typeof getFeed>> };
    const feed = await getFeed({ data: { sort: "latest", cursor: 0, ids: likes.map((l) => l.pinId) } });
    const order = new Map(likes.map((l, i) => [l.pinId, i]));
    const pins = feed.filter((p) => order.has(p.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { private: false, pins };
  });

export const getSuggestedUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await getServerContext();
  const me = await getSessionUser();
  if (!me) return [];
  const rows = await db.all<{ [k: string]: unknown }>(sql`
    select u.id, u.name, u.username, u.image,
      (select count(*) from "follow" f2 where f2.following_id = u.id) as followerCount,
      (select count(*) from pin p where p.user_id = u.id) as pinCount
    from user u
    where u.id != ${me.id}
      and u.id not in (select following_id from "follow" where follower_id = ${me.id})
    order by followerCount desc
    limit 6
  `);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    username: r.username as string,
    image: (r.image as string | null) ?? null,
    followerCount: Number(r.followerCount ?? 0),
    pinCount: Number(r.pinCount ?? 0),
  }));
});

export const getRelatedTags = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: pinId }) => {
    const { db } = await getServerContext();
    const [pin] = await db
      .select({ tags: schema.pin.tags })
      .from(schema.pin)
      .where(eq(schema.pin.id, pinId))
      .limit(1);
    const own = pin?.tags ?? [];
    if (!own.length) return [];
    // co-occurring tags on pins sharing any of this pin's tags
    const rows = await db
      .select({ tags: schema.pin.tags })
      .from(schema.pin)
      .where(ne(schema.pin.id, pinId))
      .limit(200);
    const counts = new Map<string, number>();
    for (const r of rows) {
      const tags = r.tags ?? [];
      if (!tags.some((t) => own.includes(t))) continue;
      for (const t of tags) {
        if (own.includes(t)) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag]) => tag);
  });

export const getRelatedPins = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data: pinId }) => {
    const { db } = await getServerContext();
    const [pin] = await db
      .select({ id: schema.pin.id, tags: schema.pin.tags })
      .from(schema.pin)
      .where(eq(schema.pin.id, pinId))
      .limit(1);
    if (!pin) return [];
    const [m] = await db
      .select({ slug: schema.muse.slug })
      .from(schema.pinMuse)
      .innerJoin(schema.muse, eq(schema.muse.id, schema.pinMuse.museId))
      .where(eq(schema.pinMuse.pinId, pinId))
      .limit(1);
    // score candidates: shared tags > same muse > recency
    const ownTags = (pin.tags ?? []).map((t) => t.toLowerCase());
    const pool = await getFeed({ data: { sort: "latest", cursor: 0 } });
    const candidates = pool.filter((p) => p.id !== pinId);
    const museSet = new Set<string>();
    if (m?.slug) museSet.add(m.slug);
    const scored = candidates.map((p) => {
      let score = 0;
      const ptags = (p.tags ?? []).map((t) => t.toLowerCase());
      const shared = ptags.filter((t) => ownTags.includes(t)).length;
      score += shared * 10;
      if (museSet.size && p.muses?.some((mu) => museSet.has(mu.slug))) score += 5;
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const merged = scored.filter((s) => s.score > 0).map((s) => s.p);
    for (const s of scored) {
      if (s.score === 0) merged.push(s.p);
      if (merged.length >= 12) break;
    }
    return merged.slice(0, 12);
  });

/* -------------------------------- analytics -------------------------------- */

export const isAdminUser = (user: { role?: string | null } | null) => !!user && user.role === "admin";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdminUser(user)) throw new Error("Admin access required");
  return user;
}

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!isAdminUser(user)) throw new Error("Sign in required");
  const { db } = await getServerContext();
  const [{ views }] = await db
    .select({ views: sql<number>`count(*)` })
    .from(schema.analyticsEvent)
    .where(eq(schema.analyticsEvent.type, "pageview"));
  const [{ events }] = await db
    .select({ events: sql<number>`count(*)` })
    .from(schema.analyticsEvent)
    .where(eq(schema.analyticsEvent.type, "event"));
  const [{ users }] = await db.select({ users: sql<number>`count(*)` }).from(schema.user);
  const [{ pins }] = await db.select({ pins: sql<number>`count(*)` }).from(schema.pin);
  const [{ comments }] = await db.select({ comments: sql<number>`count(*)` }).from(schema.comment);
  const [{ likes }] = await db.select({ likes: sql<number>`count(*)` }).from(schema.like);
  return {
    views: Number(views),
    events: Number(events),
    users: Number(users),
    pins: Number(pins),
    comments: Number(comments),
    likes: Number(likes),
  };
});

export const getAdminTimeseries = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!isAdminUser(user)) throw new Error("Sign in required");
  const { db } = await getServerContext();
  const rows = await db.all<{ [k: string]: unknown }>(sql`
    select date(created_at, 'unixepoch') as day,
      sum(case when type = 'pageview' then 1 else 0 end) as views,
      sum(case when type != 'pageview' then 1 else 0 end) as events
    from analytics_event
    where created_at > unixepoch() - 30*86400
    group by day order by day
  `);
  return rows.map((r) => ({ day: r.day as string, views: Number(r.views), events: Number(r.events) }));
});

export const getAdminTopPages = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!isAdminUser(user)) throw new Error("Sign in required");
  const { db } = await getServerContext();
  const rows = await db.all<{ [k: string]: unknown }>(sql`
    select coalesce(path, '/') as path, count(*) as views
    from analytics_event where type = 'pageview'
    group by path order by views desc limit 10
  `);
  return rows.map((r) => ({ path: r.path as string, views: Number(r.views) }));
});

export const getAdminTopPins = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!isAdminUser(user)) throw new Error("Sign in required");
  const { db } = await getServerContext();
  const rows = await db.all<{ [k: string]: unknown }>(sql`
    select p.id, p.title, p.image_url as imageUrl,
      (select count(*) from "like" l where l.pin_id = p.id) as likeCount,
      (select count(*) from comment c where c.pin_id = p.id) as commentCount,
      (select count(*) from analytics_event ae where ae.props like '%' || p.id || '%') as eventCount
    from pin p
    order by likeCount desc, eventCount desc limit 8
  `);
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    imageUrl: r.imageUrl as string,
    likeCount: Number(r.likeCount ?? 0),
    commentCount: Number(r.commentCount ?? 0),
    eventCount: Number(r.eventCount ?? 0),
  }));
});

export const getAdminTopMuses = createServerFn({ method: "GET" })
  .validator(z.object({ days: z.number().int().optional() }).default({}))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!isAdminUser(user)) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const cutoff = data.days ? sql`and up.updated_at >= unixepoch() - ${data.days * 86400}` : sql``;
    const rows = await db.all<{ [k: string]: unknown }>(sql`
      select m.id, m.name, m.slug,
        (select count(*) from pin_muse pm where pm.muse_id = m.id) as pinCount,
        (select count(*) from user_preference up where up.kind = 'muse' and up.key = m.id) as fanCount,
        (select coalesce(sum(up.score), 0) from user_preference up where up.kind = 'muse' and up.key = m.id ${cutoff}) as affinity
      from muse m
      order by affinity desc, pinCount desc limit 10
    `);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    pinCount: Number(r.pinCount ?? 0),
    fanCount: Number(r.fanCount ?? 0),
    affinity: Number(r.affinity ?? 0),
  }));
});

export const getAdminTopTags = createServerFn({ method: "GET" })
  .validator(z.object({ days: z.number().int().optional() }).default({}))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!isAdminUser(user)) throw new Error("Sign in required");
    const { db } = await getServerContext();
    const cutoff = data.days ? sql`and up.updated_at >= unixepoch() - ${data.days * 86400}` : sql``;
    const rows = await db.all<{ [k: string]: unknown }>(sql`
      select up.key as tag, count(*) as fans, coalesce(sum(up.score), 0) as affinity
      from user_preference up where up.kind = 'tag' ${cutoff}
      group by up.key order by affinity desc limit 12
    `);
    return rows.map((r) => ({ tag: r.tag as string, fans: Number(r.fans ?? 0), affinity: Number(r.affinity ?? 0) }));
  });

export const getAdminRecentEvents = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!isAdminUser(user)) throw new Error("Sign in required");
  const { db } = await getServerContext();
  return db
    .select({
      id: schema.analyticsEvent.id,
      type: schema.analyticsEvent.type,
      name: schema.analyticsEvent.name,
      path: schema.analyticsEvent.path,
      createdAt: schema.analyticsEvent.createdAt,
    })
    .from(schema.analyticsEvent)
    .orderBy(desc(schema.analyticsEvent.createdAt))
    .limit(15);
});

export const getMyTopMuses = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  const { db } = await getServerContext();
  const rows = await db
    .select({
      id: schema.muse.id,
      name: schema.muse.name,
      slug: schema.muse.slug,
      score: schema.userPreference.score,
    })
    .from(schema.userPreference)
    .innerJoin(schema.muse, eq(schema.muse.id, schema.userPreference.key))
    .where(and(eq(schema.userPreference.userId, user.id), eq(schema.userPreference.kind, "muse")))
    .orderBy(desc(schema.userPreference.score))
    .limit(8);
  return rows.map((r) => ({ ...r, score: Number(r.score) }));
});

/* ------------------------------- moderation ------------------------------- */

/** Submit a report on a pin, comment or user. */
export const reportContent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      targetType: z.enum(["pin", "comment", "user"]),
      targetId: z.string().min(1).max(64),
      reason: z.enum(["spam", "harassment", "nsfw", "copyright", "other"]),
      details: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("Sign in required");
    await requireRate("report", user.id, { tight: false });
    const { db } = await getServerContext();

    // one open report per user per target
    const [existing] = await db
      .select({ id: schema.report.id })
      .from(schema.report)
      .where(and(eq(schema.report.reporterId, user.id), eq(schema.report.targetId, data.targetId), eq(schema.report.status, "open")))
      .limit(1);
    if (existing) return { ok: true, duplicate: true };

    await db.insert(schema.report).values({
      id: id(),
      reporterId: user.id,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      details: data.details || null,
    });
    return { ok: true, duplicate: false };
  });

export const getAdminReports = createServerFn({ method: "GET" })
  .validator(z.object({ status: z.enum(["open", "actioned", "dismissed"]).default("open") }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { db } = await getServerContext();
    const commentTbl = alias(schema.comment, "report_comment");
    const pinTbl = alias(schema.pin, "report_pin");
    const authorTbl = alias(schema.user, "report_author");
    const rows = await db
      .select({
        id: schema.report.id,
        targetType: schema.report.targetType,
        targetId: schema.report.targetId,
        reason: schema.report.reason,
        details: schema.report.details,
        status: schema.report.status,
        createdAt: schema.report.createdAt,
        reporterName: schema.user.name,
        reporterUsername: schema.user.username,
        commentBody: commentTbl.body,
        commentPinId: commentTbl.pinId,
        pinImage: pinTbl.imageUrl,
        pinTitle: pinTbl.title,
        authorUsername: authorTbl.username,
      })
      .from(schema.report)
      .innerJoin(schema.user, eq(schema.user.id, schema.report.reporterId))
      .leftJoin(commentTbl, eq(commentTbl.id, schema.report.targetId))
      .leftJoin(pinTbl, and(eq(pinTbl.id, schema.report.targetId), eq(schema.report.targetType, "pin")))
      .leftJoin(authorTbl, eq(authorTbl.id, pinTbl.userId))
      .where(eq(schema.report.status, data.status))
      .orderBy(desc(schema.report.createdAt))
      .limit(100);
    return rows;
  });

/** Resolve a report by removing the reported content (pin/comment) or banning a user. */
export const moderateReport = createServerFn({ method: "POST" })
  .validator(
    z.object({
      reportId: z.string(),
      action: z.enum(["remove_content", "dismiss"]),
      banUser: z.boolean().optional(),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const { db, auth } = await getServerContext();

    const [report] = await db.select().from(schema.report).where(eq(schema.report.id, data.reportId)).limit(1);
    if (!report) throw new Error("Report not found");
    if (report.status !== "open") throw new Error("Report already resolved");

    let removedUserId: string | null = null;
    if (data.action === "remove_content") {
      if (report.targetType === "pin") {
        const [pin] = await db.select({ userId: schema.pin.userId }).from(schema.pin).where(eq(schema.pin.id, report.targetId)).limit(1);
        await db.delete(schema.pin).where(eq(schema.pin.id, report.targetId));
        removedUserId = pin?.userId ?? null;
      } else if (report.targetType === "comment") {
        const [c] = await db.select({ userId: schema.comment.userId }).from(schema.comment).where(eq(schema.comment.id, report.targetId)).limit(1);
        await db.delete(schema.comment).where(eq(schema.comment.id, report.targetId));
        removedUserId = c?.userId ?? null;
      } else {
        removedUserId = report.targetId;
      }
      if (data.banUser && removedUserId) {
        await auth.api.banUser({ body: { userId: removedUserId, banReason: data.note || "Content moderation" }, headers: await getHeaders() });
      }
    }

    // auto-resolve other open reports on the same target
    await db
      .update(schema.report)
      .set({ status: data.action === "remove_content" ? "actioned" : "dismissed", resolvedBy: admin.id, resolvedAt: new Date() })
      .where(and(eq(schema.report.targetType, report.targetType), eq(schema.report.targetId, report.targetId), eq(schema.report.status, "open")));

    return { ok: true };
  });
