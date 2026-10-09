"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export const SEARCH_INPUT_ID = "df-search";

/** The Spotlight bar. Submits to /search, keeps the subject filter. */
export function SearchBar({
  defaultValue = "",
  subjectId,
  autoFocus,
  trailing,
}: {
  defaultValue?: string;
  subjectId?: string | null;
  autoFocus?: boolean;
  trailing?: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.current && input.current.value !== defaultValue) input.current.value = defaultValue;
  }, [defaultValue]);

  return (
    <form
      role="search"
      className="flex h-16 items-center gap-4 rounded-full border border-border bg-white pr-3 pl-6 shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-[border-color,box-shadow] focus-within:border-foreground/60 focus-within:shadow-[0_2px_10px_rgb(0_0_0/0.06)]"
      onSubmit={(e) => {
        e.preventDefault();
        const q = input.current?.value.trim();
        if (!q) return;
        const params = new URLSearchParams({ q });
        if (subjectId) params.set("subject", subjectId);
        router.push(`/search?${params}`);
      }}
    >
      <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        Search inside your documents, or ask
      </label>
      <input
        ref={input}
        id={SEARCH_INPUT_ID}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search inside your documents, or ask"
        className="min-w-0 flex-1 bg-transparent text-[19px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="hidden shrink-0 rounded-md border border-border px-2 py-0.5 font-sans text-sm text-muted-foreground sm:block">⌘K</kbd>
      {trailing}
    </form>
  );
}
