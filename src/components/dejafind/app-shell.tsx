"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { simulateCapture } from "@/lib/client/api";
import { USE_MOCK } from "@/lib/client/config";
import { EventsProvider } from "./events";
import { FilingSnackbar } from "./filing-snackbar";
import { SEARCH_INPUT_ID } from "./search-bar";

/** ⌘K focuses the search bar from anywhere; on screens without one it opens Search. */
function CommandK() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.select();
      } else {
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

/** Mock only: `window.dejafindSimulate()` plays a capture so the demo can be rehearsed without the core. */
function MockHooks() {
  useEffect(() => {
    if (!USE_MOCK) return;
    (window as unknown as { dejafindSimulate: () => void }).dejafindSimulate = () => void simulateCapture();
  }, []);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <EventsProvider>
      {children}
      <CommandK />
      <MockHooks />
      <FilingSnackbar />
      <Toaster />
    </EventsProvider>
  );
}
