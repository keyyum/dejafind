import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderNav } from "./header-nav";
import { StatusPanel } from "./status-panel";
import { Wordmark } from "./wordmark";

/** Wordmark left, the three grey words right. `left` replaces the wordmark (back links). */
export function SiteHeader({ left, center }: { left?: ReactNode; center?: ReactNode }) {
  return (
    <>
    <a
      href="#main"
      className="sr-only rounded-full bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Skip to content
    </a>
    <header className="mx-auto grid w-full max-w-[1320px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 pt-5 sm:px-12">
      <div className="flex items-center gap-8 justify-self-start">
        {left ?? (
          <Link href="/" aria-label="DéjàFind, your documents" className="rounded text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wordmark />
          </Link>
        )}
        <HeaderNav />
      </div>
      <div className="justify-self-center">{center}</div>
      <div className="justify-self-end">
        <StatusPanel />
      </div>
    </header>
    </>
  );
}
