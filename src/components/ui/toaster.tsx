import { useEffect, useState } from "react";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastIndicator,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export type FeedbackTone = "default" | "danger";

type FeedbackAction = { label: string; onClick: () => void };

type FeedbackItem = {
  id: number;
  tone: FeedbackTone;
  title: string;
  description?: string;
  action?: FeedbackAction;
  durable?: boolean;
};

let seq = 1;
let items: FeedbackItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function push(input: Omit<FeedbackItem, "id">): number {
  const id = seq++;
  items = [...items.slice(-3), { ...input, id }];
  emit();
  return id;
}

export const feedback = {
  show(title: string, opts?: { description?: string; action?: FeedbackAction; durable?: boolean }) {
    return push({ tone: "default", title, description: opts?.description, action: opts?.action, durable: opts?.durable });
  },
  error(title: string, opts?: { description?: string; action?: FeedbackAction }) {
    return push({ tone: "danger", title, description: opts?.description, action: opts?.action, durable: true });
  },
  dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
    emit();
  },
};

function useFeedback() {
  const [snap, setSnap] = useState<FeedbackItem[]>(() => items);
  useEffect(() => {
    const onEmit = () => setSnap([...items]);
    listeners.add(onEmit);
    onEmit();
    return () => {
      listeners.delete(onEmit);
    };
  }, []);
  return snap;
}

export function Toaster() {
  const toasts = useFeedback();
  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          open
          variant={t.tone === "danger" ? "danger" : "default"}
          appearance="actionable"
          durable={t.durable}
          onOpenChange={(open) => {
            if (!open) feedback.dismiss(t.id);
          }}
        >
          <ToastIndicator />
          <ToastTitle>{t.title}</ToastTitle>
          {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
          {t.action ? (
            <ToastAction altText={t.action.label} onClick={t.action.onClick}>
              {t.action.label}
            </ToastAction>
          ) : null}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
