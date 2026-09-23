import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // nullable: OAuth signups (Google) arrive without one and claim it on /welcome
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  bio: text("bio"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  role: text("role").notNull().default("user"),
  showNsfw: integer("show_nsfw", { mode: "boolean" }).notNull().default(false),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  impersonatedBy: text("impersonated_by"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  password: text("password"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/** A muse: the idol/model/character a pin's media features. */
export const muse = sqliteTable(
  "muse",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    aliases: text("aliases"), // comma-separated
    description: text("description"),
    avatarUrl: text("avatar_url"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("muse_name_idx").on(t.name)],
);

/** A pin: one media post. */
export const pin = sqliteTable(
  "pin",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    sourceUrl: text("source_url"),
    isNsfw: integer("is_nsfw", { mode: "boolean" }).notNull().default(false),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("pin_user_idx").on(t.userId), index("pin_created_idx").on(t.createdAt)],
);

/** Analytics: pageviews + custom events (better-analytics SDK). */
export const analyticsEvent = sqliteTable(
  "analytics_event",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // "pageview" | "event"
    name: text("name"), // event name, null for pageviews
    path: text("path"),
    referrer: text("referrer"),
    sessionId: text("session_id"),
    userId: text("user_id"),
    props: text("props", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("analytics_created_idx").on(t.createdAt), index("analytics_type_idx").on(t.type)],
);

/** Per-user affinity toward muses/tags, derived from tracked interactions. */
export const userPreference = sqliteTable(
  "user_preference",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "muse" | "tag"
    key: text("key").notNull(), // muse id or tag text
    score: real("score").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("user_pref_unique").on(t.userId, t.kind, t.key), index("user_pref_user_idx").on(t.userId)],
);

/** Many-to-many: pins are tagged with muses. */
export const pinMuse = sqliteTable(
  "pin_muse",
  {
    pinId: text("pin_id")
      .notNull()
      .references(() => pin.id, { onDelete: "cascade" }),
    museId: text("muse_id")
      .notNull()
      .references(() => muse.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("pin_muse_unique").on(t.pinId, t.museId),
    index("pin_muse_muse_idx").on(t.museId),
  ],
);

export const collection = sqliteTable(
  "collection",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("collection_user_idx").on(t.userId)],
);

export const collectionCollaborator = sqliteTable(
  "collection_collaborator",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"), // editor | viewer
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("collab_collection_idx").on(t.collectionId), index("collab_user_idx").on(t.userId)],
);

export const collectionPin = sqliteTable(
  "collection_pin",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    pinId: text("pin_id")
      .notNull()
      .references(() => pin.id, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("collection_pin_unique").on(t.collectionId, t.pinId)],
);

export const like = sqliteTable(
  "like",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pinId: text("pin_id")
      .notNull()
      .references(() => pin.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("like_unique").on(t.userId, t.pinId), index("like_pin_idx").on(t.pinId)],
);

export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    pinId: text("pin_id")
      .notNull()
      .references(() => pin.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    parentId: text("parent_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("comment_pin_idx").on(t.pinId), index("comment_parent_idx").on(t.parentId)],
);

/** Likes on comments. */
export const commentLike = sqliteTable(
  "comment_like",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    commentId: text("comment_id")
      .notNull()
      .references(() => comment.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("comment_like_unique").on(t.userId, t.commentId)],
);

export const follow = sqliteTable(
  "follow",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("follow_unique").on(t.followerId, t.followingId),
    index("follow_following_idx").on(t.followingId),
  ],
);

export const report = sqliteTable(
  "report",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // pin | comment | user
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(), // spam | harassment | nsfw | copyright | other
    details: text("details"),
    status: text("status").notNull().default("open"), // open | actioned | dismissed
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("report_status_idx").on(t.status),
    index("report_target_idx").on(t.targetType, t.targetId),
  ],
);

export const notification = sqliteTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // recipient
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }), // who did it
    type: text("type").notNull(), // like | save | comment | follow
    pinId: text("pin_id").references(() => pin.id, { onDelete: "cascade" }),
    commentId: text("comment_id"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);
