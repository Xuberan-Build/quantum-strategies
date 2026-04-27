"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Hero from "@/components/hero/Hero";
import FlashOverlay from "@/components/layout/FlashOverlay";
import ServicesSection from "@/components/services/ServicesSection";
import LazyMount from "@/components/performance/LazyMount";

const ResultsSection = dynamic(() => import("@/components/results/ResultsSection"));
const ContactSection = dynamic(() => import("@/components/contact/ContactSection"));
const Modal = dynamic(() => import("@/components/modals/Modal"), { ssr: false });
const PortfolioModal = dynamic(() => import("@/components/modals/PortfolioModal"), { ssr: false });

export default function HomeClient() {
  const [resumeOpen, setResumeOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const servicesRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hasScrolledRef = { current: false };

    const onScroll = () => {
      if (window.scrollY > 16) hasScrolledRef.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let io: IntersectionObserver | null = null;
    let timeoutId: number | null = null;

    if (servicesRef.current) {
      const el = servicesRef.current;
      io = new IntersectionObserver(
        entries => {
          const e = entries[0];
          if (hasScrolledRef.current && e.isIntersecting) {
            setFlash(true);
            timeoutId = window.setTimeout(() => setFlash(false), 700);
            io?.unobserve(el);
          }
        },
        { root: null, threshold: 0.25, rootMargin: "-40% 0px -40% 0px" }
      );
      io.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (io) io.disconnect();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <FlashOverlay active={flash} />

      <Hero
        onOpenResume={() => setResumeOpen(true)}
        onOpenPortfolio={() => setPortfolioOpen(true)}
      />

      {resumeOpen && (
        <Modal
          title="Resume — Austin Santos"
          isOpen={resumeOpen}
          onClose={() => setResumeOpen(false)}
        >
          <article className="stack" aria-labelledby="resume-name">
          <header className="stack">
            <h3 id="resume-name" style={{ margin: 0, color: "#fff" }}>
              Austin Santos
            </h3>
            <p style={{ margin: 0 }}>
              <strong>Alpharetta, GA</strong> · 952.688.2724 ·{" "}
              <a href="mailto:austin.j.santos.93@gmail.com">austin.j.santos.93@gmail.com</a> ·{" "}
              <a
                href="https://www.linkedin.com/in/austinsantos"
                target="_blank"
                rel="noreferrer"
              >
                linkedin.com/in/austinsantos
              </a>
            </p>
          </header>

          <section className="stack" aria-labelledby="exp-h">
            <h4 id="exp-h" style={{ marginBottom: ".25rem", color: "#fff" }}>
              Professional Experience
            </h4>

            <div
              className="stack"
              style={{
                padding: ".75rem 0",
                borderTop: "1px solid rgba(206,190,255,.2)",
              }}
            >
              <p style={{ margin: 0, color: "#fff" }}>
                <strong>Director Digital Marketing</strong> · Locus Digital · Irvine, Texas ·{" "}
                <em>Mar 2022 – Present</em>
              </p>
              <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                <li>
                  Spearheaded holistic marketing service transformation, driving{" "}
                  <strong>300% client retention</strong> and <strong>20× CLV</strong>, generating{" "}
                  <strong>$2.5M</strong> incremental revenue.
                </li>
                <li>
                  Executed <strong>150+</strong> integrated B2B campaigns (SEO/email/PPC)
                  delivering consistent <strong>8% organic growth</strong>.
                </li>
                <li>
                  Retention model &amp; service ecosystem overhaul: <strong>10×</strong> content
                  engagement and <strong>500%</strong> potential portfolio value acceleration.
                </li>
              </ul>
            </div>

            <div
              className="stack"
              style={{
                padding: ".75rem 0",
                borderTop: "1px solid rgba(206,190,255,.2)",
              }}
            >
              <p style={{ margin: 0, color: "#fff" }}>
                <strong>Senior Marketing Executive</strong> · Xuberan Digital · Roanoke, Texas ·{" "}
                <em>Jul 2021 – Present</em>
              </p>
              <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                <li>
                  Multi-platform MarTech integration → <strong>$150k</strong> efficiency,
                  conversions from <strong>3%</strong> → <strong>9%</strong>.
                </li>
                <li>
                  Acquisition framework: <strong>+80% YoY leads</strong>,{" "}
                  <strong>80% retention</strong>, <strong>$20M</strong> pipeline.
                </li>
                <li>
                  Data-driven revenue programs → ~<strong>20%</strong> business lift.
                </li>
              </ul>
            </div>

            <div
              className="stack"
              style={{
                padding: ".75rem 0",
                borderTop: "1px solid rgba(206,190,255,.2)",
              }}
            >
              <p style={{ margin: 0, color: "#fff" }}>
                <strong>Sales &amp; Marketing Operations Director</strong> · Sunday Roast ·
                Lindsay, Ontario · <em>Jan 2021 – Apr 2022</em>
              </p>
              <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                <li>
                  Product expansion + SEO org → pipeline <strong>+80%</strong>,{" "}
                  <strong>$1M+</strong> revenue @ <strong>50%</strong> margin.
                </li>
                <li>
                  CAC reduced <strong>20%</strong> via systemization &amp; infra upgrades.
                </li>
                <li>
                  Owned ops; managed <strong>$500k</strong> marketing budget.
                </li>
              </ul>
            </div>

            <div
              className="stack"
              style={{
                padding: ".75rem 0",
                borderTop: "1px solid rgba(206,190,255,.2)",
              }}
            >
              <p style={{ margin: 0, color: "#fff" }}>
                <strong>SEO Specialist</strong> · Meridian Media Works · Wilmington, NC ·{" "}
                <em>Jan 2018 – Jan 2021</em>
              </p>
              <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                <li>
                  <strong>$4M+</strong> direct sales and <strong>$12M</strong> in pipeline via SEO.
                </li>
                <li>Ops workflows improving visibility &amp; throughput.</li>
                <li>
                  <strong>8% MoM</strong> traffic growth; <strong>+3%pt</strong> conversion.
                </li>
              </ul>
            </div>
          </section>

          <section
            className="stack"
            aria-labelledby="edu-h"
            style={{
              borderTop: "1px solid rgba(206,190,255,.2)",
              paddingTop: ".75rem",
            }}
          >
            <h4 id="edu-h" style={{ marginBottom: ".25rem", color: "#fff" }}>
              Education
            </h4>
            <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>
                <strong>B.A., Interdisciplinary</strong> · Liberty University · Mar 2018
              </li>
              <li>
                <strong>Digital Marketing: CE, Social, Planning &amp; Analytics</strong> ·
                Columbia University · May 2021
              </li>
            </ul>
          </section>

          <section
            className="stack"
            aria-labelledby="skills-h"
            style={{
              borderTop: "1px solid rgba(206,190,255,.2)",
              paddingTop: ".75rem",
            }}
          >
            <h4 id="skills-h" style={{ marginBottom: ".25rem", color: "#fff" }}>
              Skills
            </h4>
            <p style={{ margin: 0 }}>
              Strategic Planning · Brand Positioning · Digital Transformation · Campaign
              Integration · Analytics &amp; Performance · Attribution · KPI Dev · Paid Search ·
              Programmatic · A/B Testing · Content Strategy · SEO · Email · Lifecycle ·
              Personalization · Acquisition · CRO · Retention · MarTech · CRM · Automation ·
              Budget &amp; ROI · Cross-functional Leadership.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Tools:</strong> Salesforce · Pardot · HubSpot · GA · Looker Studio · Ahrefs
              · SEMrush · Google Ads · Meta Ads · Apollo · Outreach · Zapier · ClickUp · Asana ·
              Monday · HTML · CSS · React · Webflow · Shopify · WordPress · BigCommerce · Magento.
            </p>
          </section>
          </article>
        </Modal>
      )}

      {portfolioOpen && (
        <PortfolioModal isOpen={portfolioOpen} onClose={() => setPortfolioOpen(false)} />
      )}

      <section ref={servicesRef}>
        <ServicesSection />
      </section>

      <LazyMount minHeight={600}>
        <ResultsSection />
      </LazyMount>

      <LazyMount minHeight={800}>
        <ContactSection />
      </LazyMount>
    </>
  );
}
