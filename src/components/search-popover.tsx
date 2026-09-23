import { Fragment, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Caps } from "@/components/ui/typography";
import { Icon, IconButton } from "@/components/ui/icon";
import { InputClear, InputControl, InputWrapper } from "@/components/ui/input";
import { Item, ItemGroup } from "@/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollAreaList } from "@/components/ui/scroll-area";
import { feedback } from "@/components/ui/toaster";
import { getSuggestedTags, searchMuses } from "@/lib/queries";

type RecentEntry = { type: "q" | "tag"; value: string };
type MuseHit = { id: string; name: string; slug: string };

const RECENT_KEY = "recent-searches";
const RECENT_MAX = 8;

function readRecents(): RecentEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentEntry => {
        if (!entry || typeof entry !== "object") return false;
        const e = entry as RecentEntry;
        return (
          (e.type === "q" || e.type === "tag") &&
          typeof e.value === "string" &&
          e.value.trim() !== ""
        );
      })
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecents(entries: RecentEntry[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
  } catch {}
}

type Opt =
  | { key: string; kind: "search" }
  | { key: string; kind: "recent"; entry: RecentEntry }
  | { key: string; kind: "tag"; tag: string }
  | { key: string; kind: "muse"; muse: MuseHit };

type Section = {
  key: string;
  label?: string;
  headerIcon?: string;
  action?: React.ReactNode;
  rows: Opt[];
};

export function SearchPopover({ variant = "field" }: { variant?: "field" | "icon" }) {
  const navigate = useNavigate();
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recents, setRecents] = useState<RecentEntry[]>(readRecents);
  const [chord, setChord] = useState("");
  const [barWidth, setBarWidth] = useState(0);

  const trimmed = query.trim();

  const popular = useQuery({
    queryKey: ["tagSuggest", ""],
    queryFn: () => getSuggestedTags({ data: "" }),
    enabled: open && !trimmed,
  });
  const tags = useQuery({
    queryKey: ["tagSuggest", trimmed],
    queryFn: () => getSuggestedTags({ data: trimmed }),
    enabled: open && trimmed !== "",
  });
  const muses = useQuery({
    queryKey: ["museSearch", trimmed],
    queryFn: () => searchMuses({ data: trimmed }),
    enabled: open && trimmed !== "",
  });

  function commit(entry: RecentEntry) {
    const next = [
      entry,
      ...recents.filter(
        (r) =>
          !(r.type === entry.type && r.value.toLowerCase() === entry.value.toLowerCase()),
      ),
    ].slice(0, RECENT_MAX);
    setRecents(next);
    writeRecents(next);
  }

  function removeRecent(entry: RecentEntry) {
    const next = recents.filter((r) => !(r.type === entry.type && r.value === entry.value));
    setRecents(next);
    writeRecents(next);
  }

  function clearRecents() {
    setRecents([]);
    writeRecents([]);
    feedback.show("Recent searches cleared");
  }

  function handleOpenChange(next: boolean) {
    if (next && variant === "field") {
      const width = triggerRef.current?.getBoundingClientRect().width;
      if (width) setBarWidth(width);
    }
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveIndex(-1);
    }
  }

  function run(opt: Opt) {
    if (opt.kind === "search") {
      commit({ type: "q", value: trimmed });
      navigate({ to: "/search", search: { q: trimmed, tag: "" } });
    } else if (opt.kind === "recent") {
      commit(opt.entry);
      navigate({
        to: "/search",
        search:
          opt.entry.type === "q"
            ? { q: opt.entry.value, tag: "" }
            : { q: "", tag: opt.entry.value },
      });
    } else if (opt.kind === "tag") {
      commit({ type: "tag", value: opt.tag });
      navigate({ to: "/search", search: { q: "", tag: opt.tag } });
    } else {
      navigate({ to: "/muse/$slug", params: { slug: opt.muse.slug } });
    }
    handleOpenChange(false);
  }

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed, open]);

  useEffect(() => {
    setChord(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘K" : "Ctrl K");
  }, []);

  // Both topbars stay mounted at every breakpoint; only the visible twin
  // owns the chord, and a dialog keeps the layer it already owns.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target;
      if (target instanceof Element && target.closest('[role="dialog"]')) return;
      if (!triggerRef.current?.getClientRects().length) return;
      event.preventDefault();
      handleOpenChange(!open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const q = trimmed.toLowerCase();
  const sections: Section[] = [];
  if (trimmed) {
    sections.push({ key: "search", rows: [{ key: "search", kind: "search" }] });
    const matchedRecents = recents.filter((r) => r.value.toLowerCase().includes(q));
    if (matchedRecents.length) {
      sections.push({
        key: "recent",
        label: "Recent searches",
        headerIcon: "history",
        rows: matchedRecents.map((entry) => ({
          key: `recent-${entry.type}-${entry.value}`,
          kind: "recent",
          entry,
        })),
      });
    }
    const musesList = (muses.data ?? []).slice(0, 6);
    if (musesList.length) {
      sections.push({
        key: "muses",
        label: "Muses",
        headerIcon: "user",
        rows: musesList.map((muse) => ({ key: `muse-${muse.id}`, kind: "muse", muse })),
      });
    }
    const seen = new Set(matchedRecents.map((r) => r.value.toLowerCase()));
    const tagList = (tags.data ?? []).filter((t) => !seen.has(t.toLowerCase()));
    if (tagList.length) {
      sections.push({
        key: "tags",
        label: "Tags",
        headerIcon: "tag",
        rows: tagList.map((tag) => ({ key: `tag-${tag}`, kind: "tag", tag })),
      });
    }
  } else {
    if (recents.length) {
      sections.push({
        key: "recent",
        label: "Recent searches",
        headerIcon: "history",
        action: (
          <Button variant="ghost" size="sm" onClick={clearRecents}>
            Clear
          </Button>
        ),
        rows: recents.map((entry) => ({
          key: `recent-${entry.type}-${entry.value}`,
          kind: "recent",
          entry,
        })),
      });
    }
    const popularList = popular.data ?? [];
    if (popularList.length) {
      sections.push({
        key: "popular",
        label: "Popular searches",
        headerIcon: "trending-up",
        rows: popularList.map((tag) => ({ key: `tag-${tag}`, kind: "tag", tag })),
      });
    }
  }

  const flat: Opt[] = sections.flatMap((section) => section.rows);
  const indexByKey = new Map(flat.map((row, index) => [row.key, index]));
  const active = flat.length > 0 ? Math.min(activeIndex, flat.length - 1) : -1;
  const cleanUid = uid.replace(/:/g, "");
  const optionId = (key: string, index: number) =>
    `${cleanUid}-opt-${index}-${key.replace(/[^\w-]/g, "-")}`;
  const activeId = active >= 0 ? optionId(flat[active].key, active) : undefined;
  const listId = `${cleanUid}-list`;
  const headerId = (sectionKey: string) => `${cleanUid}-sec-${sectionKey}`;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && flat.length) {
      event.preventDefault();
      setActiveIndex(active >= flat.length - 1 ? 0 : active + 1);
    } else if (event.key === "ArrowUp" && flat.length) {
      event.preventDefault();
      setActiveIndex(active <= 0 ? flat.length - 1 : active - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0) run(flat[active]);
      else if (trimmed) run({ key: "search", kind: "search" });
    }
  }

  const renderRow = (row: Opt) => {
    const index = indexByKey.get(row.key) ?? -1;
    const isActive = index !== -1 && index === active;
    const shared = {
      id: optionId(row.key, index),
      role: "option" as const,
      "aria-selected": isActive,
      // A combobox keeps focus in its input; arrows and activedescendant drive rows.
      tabIndex: -1,
      variant: (isActive ? "selected" : undefined) as "selected" | undefined,
      onClick: () => run(row),
    };
    if (row.kind === "search") {
      return (
        <Item key={row.key} {...shared}>
          <Icon name="search" size="sm" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search for “{trimmed}”</span>
          <Icon name="corner-down-left" size="sm" aria-hidden="true" className="opacity-60" />
        </Item>
      );
    }
    if (row.kind === "recent") {
      // The row itself is the item, so hover and the active seat cover the remove
      // button too; the button stops propagation so removing never runs a search.
      return (
        <Item key={row.key} {...shared} as="div" className="group" onClick={() => run(row)}>
          <Icon
            name={row.entry.type === "tag" ? "hash" : "clock"}
            size="sm"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{row.entry.value}</span>
          <IconButton
            variant="default"
            size="sm"
            aria-label={`Remove ${row.entry.value} from recent searches`}
            onClick={(event) => {
              event.stopPropagation();
              removeRecent(row.entry);
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
          >
            <Icon name="x" size="sm" aria-hidden="true" />
          </IconButton>
        </Item>
      );
    }
    if (row.kind === "muse") {
      return (
        <Item key={row.key} {...shared}>
          <Avatar size="sm">
            <AvatarFallback>{row.muse.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate">{row.muse.name}</span>
        </Item>
      );
    }
    return (
      <Item key={row.key} {...shared}>
        <Icon name="hash" size="sm" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{row.tag}</span>
      </Item>
    );
  };

  const trigger =
    variant === "field" ? (
      <button
        type="button"
        aria-label="Search"
        className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[var(--r-pill)] bg-[var(--v-beige)] px-4 text-sm text-[var(--v-text-2)] outline-none transition-colors hover:bg-[var(--v-beige-2)] focus-visible:ring-2 focus-visible:ring-[var(--v-brand)]"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search muses, tags, boards…</span>
        {chord && (
          <kbd className="ml-auto inline-flex h-5 shrink-0 items-center rounded-[var(--r-pill)] border border-[var(--v-border)] px-1.5 text-[10px] font-medium leading-none text-[var(--v-text-2)]">
            {chord}
          </kbd>
        )}
      </button>
    ) : (
      <button
        type="button"
        aria-label="Search"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-[var(--v-beige)] focus-visible:ring-2 focus-visible:ring-[var(--v-brand)]"
      >
        <Search className="size-5" />
      </button>
    );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild ref={triggerRef}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "field" ? "start" : "end"}
        collisionPadding={12}
        className="w-[min(92vw,560px)]"
        style={variant === "field" && barWidth ? { width: barWidth } : undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex flex-col gap-3">
          <InputWrapper>
            <Icon name="search" />
            <InputControl
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search pins, tags, muses…"
              aria-label="Search"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={flat.length ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <InputClear
                aria-label="Clear search"
                onClear={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              />
            )}
          </InputWrapper>

          {sections.length > 0 ? (
            <ScrollAreaList
              maxHeight="min(320px, calc(var(--radix-popover-content-available-height, 60dvh) - 88px))"
            >
              <ItemGroup id={listId} role="listbox" aria-label="Search suggestions">
                {sections.map((section) => {
                  if (section.label) {
                    return (
                      <div
                        key={section.key}
                        role="group"
                        aria-labelledby={headerId(section.key)}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-2">
                          <span
                            id={headerId(section.key)}
                            className="flex min-w-0 items-center gap-1.5"
                          >
                            {section.headerIcon && (
                              <Icon name={section.headerIcon} size="sm" aria-hidden="true" />
                            )}
                            <Caps>{section.label}</Caps>
                          </span>
                          {section.action}
                        </div>
                        {section.rows.map(renderRow)}
                      </div>
                    );
                  }
                  return <Fragment key={section.key}>{section.rows.map(renderRow)}</Fragment>;
                })}
              </ItemGroup>
            </ScrollAreaList>
          ) : popular.isLoading ? (
            <div aria-hidden="true" className="h-1" />
          ) : (
            <p className="px-1 pb-1 text-sm text-[var(--v-text-2)]">
              Start typing to search pins, tags, and muses.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
