import { betterAuth } from "better-auth";
import { admin, haveIBeenPwned, username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
import * as schema from "./db/schema";
import type { Env } from "./db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";
import { isUsernameAllowed } from "./username-policy";

export function createAuth(env: Env) {
  const db = getDb(env.DB);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL, "http://localhost:3000"],
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail({ to: user.email, url, apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail({ to: user.email, url, apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
        // Google reports a trustworthy email_verified signal
        requireEmailVerification: true,
      },
    },
    // same email via password and Google merges into one account
    accountLinking: { enabled: true, trustedProviders: ["google"] },
    user: {
      deleteUser: { enabled: true },
    },
    plugins: [
      admin(),
      username({
        displayUsername: false,
        minUsernameLength: 3,
        // same rule as signup validation: shape + reserved names
        usernameValidator: (name) => isUsernameAllowed(name),
      }),
      haveIBeenPwned({
        customPasswordCompromisedMessage: "This password appeared in a data breach. Choose a different one.",
      }),
    ],
    // username availability endpoint stays disabled (enumeration protection)
    disabledPaths: ["/is-username-available"],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
