import type { Metadata } from "next";

// page.tsx is a client component; keep the unsubscribe utility page out of the index.
export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
