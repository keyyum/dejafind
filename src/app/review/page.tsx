import { Suspense } from "react";
import { ReviewView } from "@/components/dejafind/review-view";

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewView />
    </Suspense>
  );
}
