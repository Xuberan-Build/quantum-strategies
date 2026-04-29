import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/layout/Footer";

export default function PillarsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", paddingTop: "80px" }}>{children}</main>
      <Footer />
    </>
  );
}
