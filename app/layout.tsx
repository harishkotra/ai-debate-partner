import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACE — AI Debate Sparring",
  description: "Practice debate against an AI that always takes the other side. Fallacy detection + scorecard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
