import { Suspense } from "react";
import { SearchView } from "@/components/dejafind/search-view";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
