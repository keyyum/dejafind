import { Suspense } from "react";
import { FlashcardsView } from "@/components/dejafind/flashcards-view";

export default function FlashcardsPage() {
  return (
    <Suspense>
      <FlashcardsView />
    </Suspense>
  );
}
