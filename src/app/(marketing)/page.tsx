import type { Metadata } from "next";
import HomeClient from "@/components/home/HomeClient";

const BASE_URL = "https://quantumstrategies.online";

export const metadata: Metadata = {
  title: "Quantum Strategies — B2B Marketing Strategy & Growth Consulting",
  description:
    "Proven B2B marketing frameworks from 150+ campaigns generating $4M+ in direct sales. Strategic consulting on customer acquisition, product-market fit, and revenue operations.",
  alternates: { canonical: `${BASE_URL}/` },
  openGraph: {
    title: "Quantum Strategies — B2B Marketing Strategy & Growth Consulting",
    description:
      "Proven B2B marketing frameworks from 150+ campaigns generating $4M+ in direct sales. Strategic consulting on customer acquisition, product-market fit, and revenue operations.",
    url: `${BASE_URL}/`,
    siteName: "Quantum Strategies",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantum Strategies — B2B Marketing Strategy & Growth Consulting",
    description:
      "Proven B2B marketing frameworks from 150+ campaigns generating $4M+ in direct sales.",
  },
};

export default function Home() {
  return <HomeClient />;
}
