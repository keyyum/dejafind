import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/dejafind/app-shell";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const viewport: Viewport = { themeColor: "#fcfcfa" };

export const metadata: Metadata = {
  title: "DéjàFind",
  description:
    "The offline study brain. Snap your slides, it files them, finds your deadlines, and quizzes you. No internet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-[16px] text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
