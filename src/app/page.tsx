import { Suspense } from "react";
import { LibraryView } from "@/components/dejafind/library-view";

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
