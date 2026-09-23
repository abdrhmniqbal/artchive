import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { feedback } from "@/components/ui/toaster";
import { fieldError, usernameField } from "@/lib/auth-forms";
import { humanizeAuthError } from "@/lib/feedback";
import { claimUsername } from "@/lib/queries";
import { z } from "zod";

const claimSchema = z.object({ username: usernameField });

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
});

function WelcomePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const claim = useMutation({
    mutationFn: (value: { username: string }) => claimUsername({ data: value }),
    onSuccess: () => {
      feedback.show("Username claimed", { description: "Your wall is ready." });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/" });
    },
    onError: (e: Error) => feedback.error("Something went wrong", { description: humanizeAuthError(e) }),
  });

  const form = useForm({
    defaultValues: { username: "" },
    validators: { onSubmit: claimSchema },
    onSubmit: async ({ value }) => {
      await claim.mutateAsync(value);
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--v-canvas)] px-4 text-[var(--v-text)]">
      <div className="w-full max-w-sm">
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--r-pill)] bg-[var(--v-ink)] font-[family-name:var(--font-display)] text-base font-bold text-[var(--v-on-ink)]">
          a
        </span>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--primary)]">
          Choose your username.
        </h1>
        <p className="mt-1 text-sm text-[var(--v-text-2)]">
          This is how people find your walls. You cannot change it later.
        </p>

        <form
          className="mt-5 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.Field name="username" validators={{ onChange: usernameField }}>
            {(field) => (
              <Field>
                <FieldLabel htmlFor="welcome-username">Username</FieldLabel>
                <Input
                  id="welcome-username"
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

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                variant="accent"
                type="submit"
                disabled={!canSubmit}
                loading={isSubmitting || claim.isPending}
                className="h-12 w-full text-base"
              >
                Claim username
                <ArrowRight className="size-4" />
              </Button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  );
}
