import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, MailCheck } from "lucide-react";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { feedback } from "@/components/ui/toaster";
import {
  emailField,
  fieldError,
  nameField,
  newPasswordField,
  signupSchema,
  usernameField,
} from "@/lib/auth-forms";
import { humanizeAuthError } from "@/lib/feedback";
import { resendVerification, signup } from "@/lib/queries";

export const Route = createFileRoute("/_auth/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const resend = useMutation({
    mutationFn: (target: string) => resendVerification({ data: { email: target } }),
    onSuccess: (_d, target) => {
      setPendingEmail(target);
      feedback.show("Verification email sent", { description: `Check your inbox at ${target}.` });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const createAccount = useMutation({
    mutationFn: (value: { name: string; username: string; email: string; password: string }) =>
      signup({ data: value }),
    onSuccess: (_d, value) => {
      setPendingEmail(value.email);
      feedback.show("Account created", { description: `We sent a verification link to ${value.email}.` });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const form = useForm({
    defaultValues: { name: "", username: "", email: "", password: "" },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      await createAccount.mutateAsync(value);
    },
  });

  if (pendingEmail) {
    return (
      <>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
          Check your inbox.
        </h1>
        <p className="mt-1 text-sm text-[var(--v-text-2)]">
          We sent a verification link to {pendingEmail}. It expires in one hour.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--v-beige)]">
            <MailCheck className="size-5" />
          </span>
          <Button variant="outline" loading={resend.isPending} onClick={() => resend.mutate(pendingEmail)}>
            Resend email
          </Button>
          <button
            type="button"
            className="text-sm text-[var(--v-text-2)] underline-offset-2 hover:underline"
            onClick={() => setPendingEmail(null)}
          >
            Use a different email
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
        Claim your wall.
      </h1>
      <p className="mt-1 text-sm text-[var(--v-text-2)]">
        Save idol photos, follow muses, and build boards. Free forever.
      </p>

      <form
        className="mt-5 flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="name" validators={{ onChange: nameField }}>
          {(field) => (
            <Field>
              <FieldLabel htmlFor="signup-name">Display name</FieldLabel>
              <Input
                id="signup-name"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Myoui Mina"
                autoComplete="name"
                aria-invalid={fieldError(field) ? true : undefined}
                required
              />
              {fieldError(field) ? <FieldError>{fieldError(field)}</FieldError> : null}
            </Field>
          )}
        </form.Field>

        <form.Field name="username" validators={{ onChange: usernameField }}>
          {(field) => (
            <Field>
              <FieldLabel htmlFor="signup-username">Username</FieldLabel>
              <Input
                id="signup-username"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="mina_once"
                autoComplete="username"
                aria-invalid={fieldError(field) ? true : undefined}
                required
              />
              {fieldError(field) ? <FieldError>{fieldError(field)}</FieldError> : null}
            </Field>
          )}
        </form.Field>

        <form.Field name="email" validators={{ onChange: emailField }}>
          {(field) => (
            <Field>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldError(field) ? true : undefined}
                required
              />
              {fieldError(field) ? <FieldError>{fieldError(field)}</FieldError> : null}
            </Field>
          )}
        </form.Field>

        <form.Field name="password" validators={{ onChange: newPasswordField }}>
          {(field) => (
            <PasswordField
              id="signup-password"
              label="Password"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field)}
              autoComplete="new-password"
              placeholder="8+ characters"
              minLength={8}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              variant="accent"
              type="submit"
              disabled={!canSubmit}
              loading={isSubmitting || createAccount.isPending}
              className="h-12 w-full text-base"
            >
              Create account
              <ArrowRight className="size-4" />
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-[var(--v-text-2)]">
        By joining, you agree to be kind. Only share what you have the right to post.
      </p>
    </>
  );
}
