import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { feedback } from "@/components/ui/toaster";
import { fieldError, identityField, loginSchema, passwordField } from "@/lib/auth-forms";
import { humanizeAuthError } from "@/lib/feedback";
import { login, resendVerification } from "@/lib/queries";

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const resend = useMutation({
    mutationFn: (target: string) => resendVerification({ data: { email: target } }),
    onSuccess: (_d, target) =>
      feedback.show("Verification email sent", { description: `Check your inbox at ${target}.` }),
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const signin = useMutation({
    mutationFn: (value: { identity: string; password: string }) => login({ data: value }),
    onSuccess: () => {
      feedback.show("Welcome back", { description: "Signed in successfully." });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/" });
    },
    onError: (e: Error) => {
      if (e.message === "VERIFY_REQUIRED") {
        const id = form.state.values.identity;
        feedback.error("Email not verified", {
          description: id.includes("@")
            ? "Check your inbox for the verification link."
            : "Check the inbox of your account email for the verification link.",
          ...(id.includes("@")
            ? { action: { label: "Resend email", onClick: () => resend.mutate(id) } }
            : {}),
        });
        return;
      }
      feedback.error("Something went wrong", { description: humanizeAuthError(e) });
    },
  });

  const form = useForm({
    defaultValues: { identity: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      await signin.mutateAsync(value);
    },
  });

  return (
    <>
      <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
        Your walls missed you.
      </h1>
      <p className="mt-1 text-sm text-[var(--v-text-2)]">
        Sign in to get back to your boards, muses, and saved pins.
      </p>

      <form
        className="mt-5 flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="identity" validators={{ onChange: identityField }}>
          {(field) => (
            <Field>
              <FieldLabel htmlFor="login-identity">Email or username</FieldLabel>
              <Input
                id="login-identity"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="you@example.com or mina_once"
                autoComplete="username"
                aria-invalid={fieldError(field) ? true : undefined}
                required
              />
              {fieldError(field) ? <FieldError>{fieldError(field)}</FieldError> : null}
            </Field>
          )}
        </form.Field>

        <form.Field name="password" validators={{ onChange: passwordField }}>
          {(field) => (
            <PasswordField
              id="login-password"
              label="Password"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field)}
              autoComplete="current-password"
              placeholder="Your password"
            >
              <div className="mt-1.5 text-right">
                <Link to="/forgot-password" className="text-xs text-[var(--v-text-2)] underline-offset-2 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </PasswordField>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              variant="accent"
              type="submit"
              disabled={!canSubmit}
              loading={isSubmitting || signin.isPending}
              className="h-12 w-full text-base"
            >
              Sign in
              <ArrowRight className="size-4" />
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-[var(--v-text-2)]">
        New to Artchive?{" "}
        <Link to="/signup" className="font-medium text-[var(--v-text)] underline underline-offset-2">
          Create an account
        </Link>
        .
      </p>
    </>
  );
}
