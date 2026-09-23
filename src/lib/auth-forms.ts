import { z } from "zod";
import { isUsernameAllowed } from "./username-policy";

/** Normalize usernames the same way everywhere: lowercase, [a-z0-9_]. */
const usernameInput = z.preprocess(
  (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9_]/g, ""),
  z
    .string()
    .min(3, "Username needs at least 3 characters.")
    .refine(isUsernameAllowed, "This username is reserved. Try another one."),
);

export const loginSchema = z.object({
  identity: z.string().trim().min(1, "Enter your email or username."),
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your display name."),
  username: usernameInput,
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

/** Field-level schemas for live (onChange) validation. */
export const identityField = z.string().trim().min(1, "Enter your email or username.");
export const emailField = z.string().email("Enter a valid email address.");
export const passwordField = z.string().min(1, "Enter your password.");
export const newPasswordField = z.string().min(8, "Use at least 8 characters.");
export const nameField = z.string().trim().min(1, "Enter your display name.");
export const usernameField = usernameInput;

/**
 * Extract a displayable message from a TanStack Form field's meta errors.
 * Handles plain strings and issue objects (zod/standard-schema).
 */
export function fieldError(field: {
  state: { meta: { errors: unknown; isTouched: boolean } };
}): string | undefined {
  const { errors, isTouched } = field.state.meta;
  if (!isTouched) return undefined;
  const list = Array.isArray(errors) ? errors : errors ? [errors] : [];
  for (const e of list) {
    if (typeof e === "string" && e) return e;
    if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") {
      return (e as { message: string }).message;
    }
  }
  return undefined;
}
