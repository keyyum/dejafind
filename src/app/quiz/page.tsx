import { Suspense } from "react";
import { QuizView } from "@/components/dejafind/quiz-view";

export default function QuizPage() {
  return (
    <Suspense>
      <QuizView />
    </Suspense>
  );
}
