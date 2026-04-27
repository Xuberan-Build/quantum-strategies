export interface NavLink {
  label: string;
  href?: string;
  description?: string;
  submenu?: NavLink[];
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

export interface MegaMenuConfig {
  label: string;
  sections: NavSection[];
}

export const navigationConfig = {
  main: [
    { label: "Home", href: "/" },
    {
      label: "About",
      dropdown: [
        { label: "Meet Austin", href: "/meet", description: "Learn about the founder" },
        { label: "Our Values", href: "/values", description: "What drives us" },
      ],
    },
    {
      label: "Resources",
      href: "/resources",
      megaMenu: {
        sections: [
          {
            title: "Pillars",
            links: [
              { label: "All Pillars", href: "/pillars", description: "Our five strategic content territories" },
              { label: "The Self as Signal", href: "/pillars/the-self-as-signal", description: "Identity, perception, personal brand" },
              { label: "The Architecture of Reality", href: "/pillars/the-architecture-of-reality", description: "Waveform physics meets strategy" },
              { label: "Strategy as Alignment", href: "/pillars/strategy-as-alignment", description: "Quantum Business Framework + Three Rites" },
              { label: "Network as Infrastructure", href: "/pillars/network-as-infrastructure", description: "Community, coordination, distribution" },
              { label: "The Builder's Stack", href: "/pillars/the-builders-stack", description: "Demand generation, GTM, fundamentals" },
            ],
          },
          {
            title: "Content",
            links: [
              {
                label: "Articles",
                href: "/articles",
                submenu: [
                  { label: "All Articles", href: "/articles", description: "Browse the full library" },
                  { label: "The Self as Signal", href: "/pillars/the-self-as-signal", description: "Identity, perception, personal brand" },
                  { label: "The Architecture of Reality", href: "/pillars/the-architecture-of-reality", description: "Waveform physics meets strategy" },
                  { label: "Strategy as Alignment", href: "/pillars/strategy-as-alignment", description: "Quantum Business Framework + Three Rites" },
                  { label: "Network as Infrastructure", href: "/pillars/network-as-infrastructure", description: "Community, coordination, distribution" },
                  { label: "The Builder's Stack", href: "/pillars/the-builders-stack", description: "Demand generation, GTM, fundamentals" },
                ],
              },
              { label: "The Rite System", href: "/the-rite-system", description: "Perception, Orientation, Declaration" },
              { label: "Quantum Glossary", href: "/quantum-glossary", description: "Core terms and concepts" },
              { label: "Courses", href: "/courses" },
              { label: "White Papers", href: "/whitepapers" },
              { label: "Case Studies", href: "/portfolio" },
            ],
          },
        ],
      },
    },
    {
      label: "Products",
      megaMenu: {
        sections: [
          {
            title: "",
            links: [
              {
                label: "Rite I: Perception",
                href: "/products/perception",
                submenu: [
                  {
                    label: "Signal Awareness",
                    href: "/products/perception-rite-scan-1",
                  },
                  {
                    label: "Value Pattern Decoder",
                    href: "/products/perception-rite-scan-2",
                  },
                  {
                    label: "Boundary & Burnout",
                    href: "/products/perception-rite-scan-3",
                  },
                  {
                    label: "Money Signal",
                    href: "/products/perception-rite-scan-4",
                  },
                  {
                    label: "Competence Mapping",
                    href: "/products/perception-rite-scan-5",
                  },
                ],
              },
              {
                label: "Rite II: Orientation",
                href: "/products/orientation",
                submenu: [
                  {
                    label: "Personal Alignment",
                    href: "/products/personal-alignment",
                  },
                  {
                    label: "Business Alignment",
                    href: "/products/business-alignment",
                  },
                  {
                    label: "Brand Alignment",
                    href: "/products/brand-alignment",
                  },
                ],
              },
              {
                label: "Rite III: Declaration",
                href: "/products/declaration",
                submenu: [
                  {
                    label: "Life Vision Declaration",
                    href: "/products/declaration-rite-life-vision",
                  },
                  {
                    label: "Business Model Declaration",
                    href: "/products/declaration-rite-business-model",
                  },
                  {
                    label: "Strategic Path Declaration",
                    href: "/products/declaration-rite-strategic-path",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    { label: "Portal", href: "/dashboard" },
  ],
  footer: {
    company: [
      { label: "About", href: "/meet" },
      { label: "Values", href: "/values" },
      { label: "Contact", href: "/contact" },
    ],
    resources: [
      { label: "Pillars", href: "/pillars" },
      { label: "Articles", href: "/articles" },
      { label: "The Rite System", href: "/the-rite-system" },
      { label: "Quantum Glossary", href: "/quantum-glossary" },
      { label: "Courses", href: "/courses" },
      { label: "White Papers", href: "/whitepapers" },
      { label: "Case Studies", href: "/portfolio" },
    ],
    work: [
      { label: "Portfolio", href: "/portfolio" },
      { label: "Case Studies", href: "/portfolio#case-studies" },
      { label: "Results", href: "/#results" },
    ],
    legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
};
