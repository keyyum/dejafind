import { Suspense } from "react";
import { DocumentView } from "@/components/dejafind/document-view";

export default function DocumentPage() {
  return (
    <Suspense>
      <DocumentView />
    </Suspense>
  );
}
