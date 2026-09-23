import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { feedback } from "@/components/ui/toaster";
import { humanizeAuthError } from "@/lib/feedback";
import { resetPasswordWithToken } from "@/lib/queries";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const m = useMutation({
    mutationFn: () => resetPasswordWithToken({ data: { token: token ?? "", newPassword: password } }),
    onSuccess: () => {
      setDone(true);
      feedback.show("Password updated", { description: "Sign in with your new password." });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--v-canvas)] px-4 text-[var(--v-text)]">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
            This link is incomplete
          </h1>
          <p className="mt-1 text-sm text-[var(--v-text-2)]">
            Reset links only work when opened from your email.
          </p>
          <Button asChild variant="accent" className="mt-6">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--v-canvas)] px-4 text-[var(--v-text)]">
      <div className="w-full max-w-sm">
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--v-beige)]">
              <CheckCircle2 className="size-5" />
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
              Password updated
            </h1>
            <p className="text-sm text-[var(--v-text-2)]">Sign in with your new password to continue.</p>
            <Button variant="accent" className="mt-2" onClick={() => navigate({ to: "/login" })}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
              Choose a new password
            </h1>
            <p className="mt-1 text-sm text-[var(--v-text-2)]">Use at least 8 characters.</p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (password !== confirm) {
                  feedback.error("Passwords do not match", { description: "Retype the same password twice." });
                  return;
                }
                m.mutate();
              }}
            >
              <Field>
                <FieldLabel htmlFor="password">New password</FieldLabel>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
              </Field>
              <Button variant="accent" type="submit" loading={m.isPending} className="h-12 w-full text-base">
                Save new password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
