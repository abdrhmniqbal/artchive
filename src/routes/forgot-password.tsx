import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { feedback } from "@/components/ui/toaster";
import { humanizeAuthError } from "@/lib/feedback";
import { requestPasswordReset } from "@/lib/queries";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const m = useMutation({
    mutationFn: () => requestPasswordReset({ data: { email } }),
    onSuccess: () => {
      setDone(true);
      feedback.show("Reset link sent", { description: "Check your inbox for the next step." });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--v-canvas)] px-4 text-[var(--v-text)]">
      <div className="w-full max-w-sm">
        <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--v-text-2)] hover:text-[var(--v-text)]">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--v-beige)]">
              <MailCheck className="size-5" />
            </span>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
              Check your inbox
            </h1>
            <p className="text-sm text-[var(--v-text-2)]">
              If an account exists for {email}, a reset link is on its way. It expires in one hour.
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
              Forgot your password?
            </h1>
            <p className="mt-1 text-sm text-[var(--v-text-2)]">
              Enter your account email and we will send you a reset link.
            </p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                m.mutate();
              }}
            >
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
              </Field>
              <Button variant="accent" type="submit" loading={m.isPending} className="h-12 w-full text-base">
                Send reset link
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
