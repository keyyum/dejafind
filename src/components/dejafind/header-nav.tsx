"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [{ href: "/schedule", label: "Schedule" }];

/** Quiet header links beside the wordmark. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-6 text-[17px]">
      {LINKS.map((l) => {
        const on = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "font-semibold text-foreground" : "text-ink-soft hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
