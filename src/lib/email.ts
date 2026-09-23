import { Resend } from "resend";

let client: Resend | null = null;

function getClient(apiKey: string): Resend {
  if (!client) client = new Resend(apiKey);
  return client;
}

const FROM_FALLBACK = "Artchive <noreply@artchive.app>";

function shell(title: string, heading: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4efe4;font-family:Georgia,serif;">
<div style="max-width:480px;margin:32px auto;background:#fbf7ee;border:1px solid #ddd5c3;border-radius:20px;padding:32px;">
<div style="font-size:14px;font-weight:bold;">a&nbsp;&nbsp;Artchive</div>
<h1 style="font-size:24px;margin:16px 0 8px;">${heading}</h1>
<p style="font-size:14px;color:#5f5b55;line-height:1.6;">${body}</p>
<a href="${cta.url}" style="display:inline-block;margin-top:16px;background:#f5b8db;color:#111;border-radius:999px;padding:12px 24px;font-size:14px;font-weight:bold;text-decoration:none;">${cta.label}</a>
<p style="margin-top:24px;font-size:12px;color:#8a8478;">${title}. If you did not ask for this, you can ignore this email.</p>
</div></body></html>`;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  apiKey?: string;
  from?: string;
  devLabel: string;
  devUrl: string;
}) {
  if (!opts.apiKey) {
    console.log(`[email:dev] ${opts.devLabel} for ${opts.to}: ${opts.devUrl}`);
    return;
  }
  // NOTE: the Resend SDK resolves with { data, error } instead of throwing on
  // API errors (unverified domain, bad key, ...). Always check `error`.
  const { error } = await getClient(opts.apiKey).emails.send({
    from: opts.from ?? FROM_FALLBACK,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) {
    console.error(`[email] Resend rejected ${opts.devLabel} to ${opts.to}:`, error.message);
    throw new Error(`Email service rejected the send (${error.message}). Check RESEND_API_KEY and EMAIL_FROM domain.`);
  }
}

export async function sendVerificationEmail(opts: { to: string; url: string; apiKey?: string; from?: string }) {
  await send({
    ...opts,
    subject: "Verify your Artchive account",
    html: shell(
      "Email verification",
      "One click and you are in",
      "Thanks for joining Artchive. Confirm this email address to start saving muses and building boards.",
      { label: "Verify my email", url: opts.url },
    ),
    devLabel: "verification link",
    devUrl: opts.url,
  });
}

export async function sendPasswordResetEmail(opts: { to: string; url: string; apiKey?: string; from?: string }) {
  await send({
    ...opts,
    subject: "Reset your Artchive password",
    html: shell(
      "Password reset",
      "Pick a new password",
      "Someone asked to reset the password for this account. The link expires in one hour.",
      { label: "Reset my password", url: opts.url },
    ),
    devLabel: "password reset link",
    devUrl: opts.url,
  });
}
