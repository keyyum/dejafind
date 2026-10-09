import type { Metadata } from "next";
import { AskView } from "@/components/dejafind/ask-view";

export const metadata: Metadata = { title: "Ask · DéjàFind" };

export default function AskPage() {
  return <AskView />;
}
