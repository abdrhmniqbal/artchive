/** Turn technical/server errors into human-friendly copy. Never leak codes. */
export function humanizeAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "VERIFY_REQUIRED") return "This email is not verified yet.";
  if (/invalid credentials|invalid email or password/i.test(msg)) return "That login and password do not match. Try again.";
  if (/cannot create account/i.test(msg)) return "We could not create your account. Try different details.";
  if (/too many/i.test(msg)) return "Too many attempts. Wait a minute and try again.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Wait a minute and try again.";
  if (/invalid or expired/i.test(msg)) return "This link is invalid or expired. Request a new one.";
  if (/password.*incorrect/i.test(msg)) return "Your current password is not correct.";
  if (/do not match/i.test(msg)) return "The two passwords do not match.";
  if (/PASSWORD_COMPROMISED/i.test(msg)) return "This password appeared in a data breach. Choose a different one.";
  if (/reserved/i.test(msg)) return "This username is reserved. Try another one.";
  if (/email.*exists|already/i.test(msg)) return "An account with this email already exists. Try signing in.";
  return "Something went wrong. Try again in a moment.";
}
