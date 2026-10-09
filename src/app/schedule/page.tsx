import type { Metadata } from "next";
import { ScheduleView } from "@/components/dejafind/schedule-view";

export const metadata: Metadata = { title: "Schedule · DéjàFind" };

export default function SchedulePage() {
  return <ScheduleView />;
}
