import type { Metadata } from "next";
import HomeClient from "@/components/home/HomeClient";
import HomeReading from "@/components/home/HomeReading";

const BASE_URL = "https://quantumstrategies.online";

export const metadata: Metadata = {
  title: "B2B Marketing Strategy & Growth Consulting | Quantum Strategies",
  description:
    "Proven B2B marketing frameworks from 150+ campaigns generating $4M+ in direct sales. Strategic consulting on customer acquisition, product-market fit, and revenue operations.",
  alternates: { canonical: `${BASE_URL}/` },
  openGraph: {
    title: "B2B Marketing Strategy & Growth Consulting | Quantum Strategies",
    description:
      "Proven B2B marketing frameworks from 150+ campaigns generating $4M+ in direct sales. Strategic consulting on customer acquisition, product-market fit, and revenue operations.",
    url: `${BASE_URL}/`,
    siteName: "Quantum Strategies",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "B2B Marketing Strategy & Growth Consulting | Quantum Strategies",
    description:
      "Proven B2B marketing frameworks from 150+ campaigns generating $4M+ in direct sales.",
  },
};

// The reading section pulls the latest posts; refresh it every five minutes.
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <HomeClient />
      <HomeReading />
    </>
  );
}
