import type { Metadata, Viewport } from "next";
import { Inter, Bodoni_Moda } from "next/font/google";
import Script from "next/script";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/layout/Footer";
import FlashOverlay from "@/components/layout/FlashOverlay";
import CookieConsent from "@/components/legal/CookieConsent";
import "./globals.css";

const GTM_ID = "GTM-P79CLN9J";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});
const baseUrl = new URL("https://quantumstrategies.online");

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: "Quantum Strategies - Strategic Consulting & Business Growth",
  description:
    "Transform your business with strategic consulting, proven frameworks, and actionable courses. Master customer acquisition, product development, and operations.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://quantumstrategies.online/",
  },
  openGraph: {
    title: "Quantum Strategies - Strategic Consulting & Business Growth",
    description:
      "Transform your business with strategic consulting, proven frameworks, and actionable courses. Master customer acquisition, product development, and operations.",
    url: baseUrl,
    siteName: "Quantum Strategies",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantum Strategies - Strategic Consulting & Business Growth",
    description:
      "Transform your business with strategic consulting, proven frameworks, and actionable courses. Master customer acquisition, product development, and operations.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Quantum Strategies",
    url: baseUrl.toString(),
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Quantum Strategies",
    url: baseUrl.toString(),
    publisher: {
      "@type": "Organization",
      name: "Quantum Strategies",
      url: baseUrl.toString(),
    },
  };

  return (
    <html lang="en">
      <head>
        <Script
          id="gtm-consent-default"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'wait_for_update': 500
});`,
          }}
        />
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${bodoniModa.variable} ${inter.className}`}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <FlashOverlay active={false} />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
