import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/layout/Footer";
import { ReadBanner } from "@/components/read/cta/ReadPlacements";

export default function PillarsLayout({ children }: { children: React.ReactNode }) {
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
