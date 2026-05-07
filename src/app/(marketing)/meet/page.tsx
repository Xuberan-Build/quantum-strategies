import type { Metadata } from "next";
import MeetPageClient from "./MeetPageClient";

export const metadata: Metadata = {
  title: "Meet Austin Santos - B2B Marketing Strategist",
  description:
    "Austin Santos is a B2B marketing strategist with 150+ campaigns generating $4M+ in direct sales. Director of Digital Marketing with expertise in SEO, paid media, and revenue operations.",
  alternates: {
    canonical: "https://quantumstrategies.online/meet/",
  },
  openGraph: {
    title: "Meet Austin Santos - B2B Marketing Strategist",
    description:
      "Austin Santos is a B2B marketing strategist with 150+ campaigns generating $4M+ in direct sales.",
    url: "https://quantumstrategies.online/meet/",
    siteName: "Quantum Strategies",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meet Austin Santos - B2B Marketing Strategist",
    description:
      "B2B marketing strategist with 150+ campaigns generating $4M+ in direct sales.",
  },
};

export default function MeetPage() {
  return <MeetPageClient />;
}
