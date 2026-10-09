import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPanel } from "./status-panel";
import { Wordmark } from "./wordmark";

/** Wordmark left, the three grey words right. `left` replaces the wordmark (back links). */
export function SiteHeader({ left, center }: { left?: ReactNode; center?: ReactNode }) {
  return (
    <header className="mx-auto grid w-full max-w-[1320px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 pt-5 sm:px-12">
      <div className="justify-self-start">
        {left ?? (
          <Link href="/" aria-label="DéjàFind, your documents" className="rounded text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Wordmark />
          </Link>
        )}
      </div>
      <div className="justify-self-center">{center}</div>
      <div className="justify-self-end">
        <StatusPanel />
      </div>
    </header>
  );
}
