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
        { label: "Meet Austin", href: "/meet/", description: "Learn about the founder" },
        { label: "Our Values", href: "/values/", description: "What drives us" },
      ],
    },
    {
      label: "Resources",
      href: "/resources/",
      megaMenu: {
        sections: [
          {
            title: "Content",
            links: [
              {
                label: "Articles",
                href: "/articles/",
                submenu: [
                  { label: "All Articles", href: "/articles/" },
                  // The first category with articles is the panel shown before anything is hovered.
                  {
                    label: "Start here: Attention & Perception",
                    href: "/articles/reticular-activating-system/",
                    submenu: [
                      { label: "Reticular activating system: what it does", href: "/articles/reticular-activating-system/" },
                      { label: "Selective attention and the gorilla test", href: "/articles/selective-attention/" },
                      { label: "Baader-Meinhof phenomenon and why it happens", href: "/articles/baader-meinhof-phenomenon/" },
                      { label: "Confirmation bias starts in what you see", href: "/articles/confirmation-bias/" },
                      { label: "How your self-image decides what you notice", href: "/articles/self-image/" },
                      { label: "Does a manifestation vision board work?", href: "/articles/manifestation-vision-board/" },
                    ],
                  },
                  {
                    label: "Identity & Brand",
                    href: "/pillars/the-self-as-signal/",
                    description: "The Self as Signal",
                    submenu: [
                      { label: "How your self-image decides what you notice", href: "/articles/self-image/" },
                      { label: "The Perception Audit", href: "/articles/the-perception-audit/" },
                      { label: "Your Brand Is Leaking", href: "/articles/your-brand-is-leaking/" },
                      { label: "Ego Dissolution Is a Business Strategy", href: "/articles/ego-dissolution-is-a-business-strategy/" },
                      { label: "All Identity & Brand articles →", href: "/articles/?topic=identity-and-brand" },
                    ],
                  },
                  {
                    label: "Mindset & Worldview",
                    href: "/pillars/the-architecture-of-reality/",
                    description: "The Architecture of Reality",
                    submenu: [
                      { label: "Reticular activating system: what it does", href: "/articles/reticular-activating-system/" },
                      { label: "Confirmation bias starts in what you see", href: "/articles/confirmation-bias/" },
                      { label: "Does a manifestation vision board work?", href: "/articles/manifestation-vision-board/" },
                      { label: "The Waveforms series (12 parts)", href: "/articles/waveforms/" },
                      { label: "All Mindset & Worldview articles →", href: "/articles/?topic=mindset-and-worldview" },
                    ],
                  },
                  {
                    label: "Business Strategy",
                    href: "/pillars/strategy-as-alignment/",
                    description: "Strategy as Alignment",
                    submenu: [
                      { label: "Why Your Business Strategy Keeps Failing", href: "/articles/business-strategy-alignment/" },
                      { label: "The V.A.S.T. Stack for Founders", href: "/articles/business-framework-for-founders/" },
                      { label: "The Three Rites as a Business Diagnostic", href: "/articles/offer-stack-audit/" },
                      { label: "Offer Design as Spiritual Practice", href: "/articles/offer-positioning-strategy/" },
                      { label: "All Business Strategy articles →", href: "/articles/?topic=business-strategy" },
                    ],
                  },
                  {
                    label: "Network & Community",
                    href: "/pillars/network-as-infrastructure/",
                    description: "Network as Infrastructure",
                    submenu: [
                      { label: "Kingdom Economics: Your Network Is Your Balance Sheet", href: "/articles/network-building-strategy/" },
                      { label: "The Dinner Party Model for Distribution", href: "/articles/organic-distribution-strategy/" },
                      { label: "Referral Architecture vs Referral Programs", href: "/articles/referral-marketing-strategy/" },
                      { label: "Discord as a Revenue System", href: "/articles/discord-community-monetization/" },
                      { label: "All Network & Community articles →", href: "/articles/?topic=network-and-community" },
                    ],
                  },
                  {
                    label: "Growth & Marketing",
                    href: "/pillars/the-builders-stack/",
                    description: "The Builder's Stack",
                    submenu: [
                      { label: "Customer Acquisition Strategy: Complete Guide", href: "/articles/complete-guide/" },
                      { label: "SEO for Customer Acquisition", href: "/articles/seo-lead-generation/" },
                      { label: "Content Marketing for Customer Acquisition", href: "/articles/content-marketing/" },
                      { label: "Product Market Fit Validation", href: "/articles/product-market-fit/" },
                      { label: "All Growth & Marketing articles →", href: "/articles/?topic=growth-and-marketing" },
                    ],
                  },
                ],
              },
              { label: "Courses", href: "/courses/" },
              { label: "White Papers", href: "/whitepapers/" },
              { label: "Case Studies", href: "/portfolio/" },
              { label: "The Rite System", href: "/the-rite-system/" },
              { label: "Quantum Glossary", href: "/quantum-glossary/" },
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
                href: "/products/perception/",
                submenu: [
                  {
                    label: "Signal Awareness",
                    href: "/products/perception-rite-scan-1/",
                  },
                  {
                    label: "Value Pattern Decoder",
                    href: "/products/perception-rite-scan-2/",
                  },
                  {
                    label: "Boundary & Burnout",
                    href: "/products/perception-rite-scan-3/",
                  },
                  {
                    label: "Money Signal",
                    href: "/products/perception-rite-scan-4/",
                  },
                  {
                    label: "Competence Mapping",
                    href: "/products/perception-rite-scan-5/",
                  },
                ],
              },
              {
                label: "Rite II: Orientation",
                href: "/products/orientation/",
                submenu: [
                  {
                    label: "Personal Alignment",
                    href: "/products/personal-alignment/",
                  },
                  {
                    label: "Business Alignment",
                    href: "/products/business-alignment/",
                  },
                  {
                    label: "Brand Alignment",
                    href: "/products/brand-alignment/",
                  },
                ],
              },
              {
                label: "Rite III: Declaration",
                href: "/products/declaration/",
                submenu: [
                  {
                    label: "Life Vision Declaration",
                    href: "/products/declaration-rite-life-vision/",
                  },
                  {
                    label: "Business Model Declaration",
                    href: "/products/declaration-rite-business-model/",
                  },
                  {
                    label: "Strategic Path Declaration",
                    href: "/products/declaration-rite-strategic-path/",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    { label: "Portal", href: "/dashboard/" },
  ],
  footer: {
    company: [
      { label: "About", href: "/meet/" },
      { label: "Values", href: "/values/" },
      { label: "Contact", href: "mailto:austin.j.santos.93@gmail.com" },
    ],
    resources: [
      { label: "Pillars", href: "/pillars/" },
      { label: "Articles", href: "/articles/" },
      { label: "The Rite System", href: "/the-rite-system/" },
      { label: "Quantum Glossary", href: "/quantum-glossary/" },
      { label: "Courses", href: "/courses/" },
      { label: "White Papers", href: "/whitepapers/" },
      { label: "Case Studies", href: "/portfolio/" },
    ],
    work: [
      { label: "Portfolio", href: "/portfolio/" },
      { label: "Case Studies", href: "/portfolio/#case-studies" },
      { label: "Results", href: "/#results" },
    ],
    legal: [
      { label: "Privacy Policy", href: "/privacy/" },
      { label: "Terms of Service", href: "/terms/" },
    ],
  },
};
