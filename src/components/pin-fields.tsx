import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Icon } from "@/components/ui/icon";
import { getSuggestedTags, searchMuses } from "@/lib/queries";

/** Schemas live next to usage. Muses and title are required on every pin form. */
export const musesField = z.string().array().min(1, "Add at least one muse.");
export const titleField = z.string().trim().min(1, "Give your pin a title.");

/* ------------------------------ title ------------------------------------- */

export function TitleField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  return (
    <Field invalid={!!error}>
      <FieldLabel>Title</FieldLabel>
      <Input value={value} onBlur={onBlur} placeholder="Pin title" onChange={(e) => onChange(e.target.value)} />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/* ---------------------------- description ---------------------------------- */

export function DescriptionField({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <Field>
      <FieldLabel>Description</FieldLabel>
      <Textarea
        value={value}
        onBlur={onBlur}
        placeholder="Describe the media (optional)"
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/* ------------------------------ muses ------------------------------------- */

const CREATE_MUSE = "__create__";

export function MuseCombobox({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const { data: suggestions } = useQuery({
    queryKey: ["museSearch", draft],
    queryFn: () => searchMuses({ data: draft.trim() || undefined }),
  });
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;
  const cur = suggestionsRef.current ?? [];
  const remaining = (suggestions ?? []).filter((s) => !value.some((v) => v.toLowerCase() === s.name.toLowerCase()));
  const trimmed = draft.trim();
  const exactTaken =
    trimmed !== "" &&
    (remaining.some((s) => s.name.toLowerCase() === trimmed.toLowerCase()) ||
      value.some((v) => v.toLowerCase() === trimmed.toLowerCase()));
  const showCreate = trimmed !== "" && !exactTaken && value.length < 8;

  async function add(name: string) {
    let match = (cur as { id: string; name: string; slug: string }[]).find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
    if (!match) {
      const fresh = await qc
        .fetchQuery({ queryKey: ["museSearch", name.trim()], queryFn: () => searchMuses({ data: name.trim() }) })
        .catch(() => []);
      match =
        (fresh ?? []).find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ??
        (fresh ?? []).find((s) => s.name.toLowerCase().startsWith(name.trim().toLowerCase()));
    }
    const n = (match?.name ?? name).trim();
    if (n && !value.some((v) => v.toLowerCase() === n.toLowerCase()) && value.length < 8) onChange([...value, n]);
    setDraft("");
  }

  const options: ComboboxOption[] = [
    ...remaining.map((s) => ({ value: s.name, label: s.name })),
    ...(showCreate ? [{ value: CREATE_MUSE, label: `Create muse "${trimmed}"` }] : []),
  ];

  return (
    <Field invalid={!!error}>
      <FieldLabel>Muses</FieldLabel>
      <Combobox
        value=""
        onValueChange={(v) => {
          if (v === CREATE_MUSE) add(trimmed);
          else add(v);
        }}
        options={options}
        placeholder="Search or add a muse…"
        emptyText={trimmed ? "Already added. Try another name." : "No muses yet. Type a name to create one."}
        aria-label="Muses"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((m) => (
            <Badge key={m} variant="pink">
              {m}
              <button
                type="button"
                aria-label={`Remove ${m}`}
                className="ml-1 inline-flex opacity-60 hover:opacity-100"
                onClick={() => onChange(value.filter((x) => x !== m))}
              >
                <Icon name="x" size="sm" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/* ------------------------------- tags ------------------------------------- */

function TagSuggestions({ draft, onPick }: { draft: string; onPick: (t: string) => void }) {
  const { data } = useQuery({
    queryKey: ["tagSuggest", draft],
    queryFn: () => getSuggestedTags({ data: draft }),
  });
  const picks = (data ?? []).filter((t) => t !== draft.trim().toLowerCase());
  if (!picks.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--v-text-2)]">Popular:</span>
      {picks.map((t) => (
        <Button key={t} type="button" size="sm" variant="outline" onClick={() => onPick(t)}>
          +{t}
        </Button>
      ))}
    </div>
  );
}

export function TagsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (!value.includes(t) && value.length < 12) onChange([...value, t]);
    setDraft("");
  }
  return (
    <Field>
      <FieldLabel>Tags</FieldLabel>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="Add a tag, then press Enter"
          enterKeyHint="enter"
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Some mobile keyboards never send a key event with key === "Enter",
            // so also accept the legacy keyCode. The Add button covers the rest.
            if ((e.key === "Enter" || e.nativeEvent.keyCode === 13) && draft.trim()) {
              e.preventDefault();
              commit();
            }
          }}
        />
        <Button type="button" size="lg" variant="secondary" disabled={!draft.trim()} onClick={commit}>
          Add
        </Button>
      </div>
      <TagSuggestions draft={draft} onPick={(t) => { if (!value.includes(t) && value.length < 12) onChange([...value, t]); setDraft(""); }} />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <Badge key={t} variant="blue">
              #{t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                className="ml-1 inline-flex opacity-60 hover:opacity-100"
                onClick={() => onChange(value.filter((x) => x !== t))}
              >
                <Icon name="x" size="sm" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </Field>
  );
}

/* --------------------------- link (source) --------------------------------- */

export function SourceField({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <Field>
      <FieldLabel>Link (source)</FieldLabel>
      <Input
        value={value}
        onBlur={onBlur}
        placeholder="https://… where this came from"
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/* ----------------------------- collection ---------------------------------- */

export function CollectionField({
  value,
  onChange,
  collections,
}: {
  value: string;
  onChange: (v: string) => void;
  collections: { id: string; name: string; pinCount: number }[] | undefined;
}) {
  return (
    <Field>
      <FieldLabel>Assign to collection</FieldLabel>
      <Combobox
        value={value}
        onValueChange={onChange}
        options={[
          { value: "", label: "No collection" },
          ...(collections ?? []).map((c) => ({
            value: c.id,
            label: `${c.name} (${c.pinCount})`,
          })),
        ]}
        placeholder="No collection"
        emptyText="No collections match."
      />
    </Field>
  );
}

/* -------------------------------- nsfw ------------------------------------- */

export function NsfwField({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[var(--r-card)] border border-[var(--v-border)] p-3">
      <span>
        <span className="block text-sm font-medium">Mark as NSFW</span>
        <span className="block text-xs text-[var(--v-text-2)]">Beta. Hidden from most viewers.</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label="Mark as NSFW" />
    </label>
  );
}
