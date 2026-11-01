import type { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/layout/Footer";
import { ReadBanner } from "@/components/read/cta/ReadPlacements";

export const metadata: Metadata = {
  title: {
    template: "%s | Quantum Strategies",
    default: "Quantum Strategies - Value Creation & Digital Marketing",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", paddingTop: "80px" }}>
        <ReadBanner />
        {children}
      </main>
      <Footer />
    </>
  );
}
