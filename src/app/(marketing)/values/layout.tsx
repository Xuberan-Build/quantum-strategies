import type { Metadata } from "next";

// page.tsx is a client component, so its metadata lives here. Without this the
// page inherited the root layout's homepage canonical and generic description.
export const metadata: Metadata = {
  title: "Values",
  description:
    "The values that guide Quantum Strategies: the operating system behind every decision, strategy and value-creation framework Austin Santos builds.",
  alternates: { canonical: "https://quantumstrategies.online/values/" },
};

export default function ValuesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
