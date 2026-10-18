import type { ComponentPropsWithoutRef } from "react";

/**
 * MDX component overrides for article / whitepaper / glossary bodies.
 *
 * The page template already renders the title as the page's only <h1>. Many
 * bodies (MDX files and DB posts seeded from them) also start with "# Title",
 * which produced 2-3 <h1>s per page. Body-level "#" headings render as <h2>
 * with the `prose-h1` class, which keeps the old h1 look (see globals.css).
 */
function BodyH1({ className, ...props }: ComponentPropsWithoutRef<"h2">) {
  return <h2 {...props} className={className ? `prose-h1 ${className}` : "prose-h1"} />;
}

export const proseComponents = {
  h1: BodyH1,
};
