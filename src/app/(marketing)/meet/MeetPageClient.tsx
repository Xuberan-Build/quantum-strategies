"use client";

import { useEffect, useState } from "react";
import "@/styles/meet.css";
import Modal from "@/components/modals/Modal";
import PortfolioModal from "@/components/modals/PortfolioModal";
import ContactModal from "@/components/modals/ContactModal";

export default function MeetPageClient() {
  const [resumeOpen, setResumeOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = document.querySelectorAll(".resume-section, .skills-category-card");
    cards.forEach(card => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <main id="main-content">
      <section className="hero-banner">
        <div className="hero-text">
          <h1>Meet Austin</h1>
          <p>
            As an INFJ entrepreneur, I blend vision, empathy, and strategic thinking to drive
            meaningful change. My intuitive nature allows me to see the bigger picture, while my
            deep understanding of human behavior helps me connect with clients and team members on
            a profound level.
          </p>
          <p>
            I am a manifestor, constantly learning and mastering the art of development. My journey
            is driven by a desire to not only explore but to inspire and uplift those around me.
          </p>
        </div>
        <div className="hero-image">
            <img
              src="/images/meet-headshot.webp"
              alt="Austin Santos - Value Creation Strategist"
              loading="lazy"
            />
        </div>
      </section>

      <section className="section-meet">
        <div className="section-meet__content">
          <div className="section-meet__body">
            <div className="section-meet__column">
              <p className="section-meet__text">
                Over the years, I have built a thriving six-figure business, generating over eight
                figures in results for my clients. My expertise in digital marketing has allowed me
                to craft impactful strategies that drive growth and maximize ROI.
              </p>
              <p className="section-meet__text">
                I am currently expanding my digital marketing business, leveraging the latest
                technologies to stay ahead of the curve. My dedication to excellence and innovation
                has made a significant impact in the industry, and I continue to explore new
                avenues to deliver unparalleled results.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-works" aria-labelledby="works-title">
        <div className="section-works__content">
          <div className="section-works__header">
            <h2 id="works-title" className="section-works__title">
              Works and Achievements
            </h2>
            <p className="section-works__text">
              Explore my portfolio of completed works and professional achievements. From driving
              over eight million in revenue to transforming marketing operations, see how I have
              helped clients achieve exceptional results.
            </p>
          </div>

          <div className="modal-container">
            <div className="modal-column__banner">
              <p className="section-projects__text">Resume and Accomplishments</p>
            </div>

            <div className="section-works__container">
              <div className="modal-column__right">
                <div className="column-row">
                  <article className="resume-section" aria-labelledby="resume-title">
                    <div className="view-container">
                      <div className="icon-container" aria-hidden="true">
                        <svg className="view-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                      </div>
                      <div className="content">
                        <h3 id="resume-title">View My Resume</h3>
                        <p>
                          Detailed overview of skills, experience, and eight million plus in proven
                          results
                        </p>
                      </div>
                      <button
                        onClick={() => setResumeOpen(true)}
                        className="view-button"
                        aria-label="View Austin Santos resume"
                      >
                        View PDF
                      </button>
                    </div>
                  </article>

                  <article className="resume-section" aria-labelledby="portfolio-title">
                    <div className="view-container">
                      <div className="icon-container" aria-hidden="true">
                        <svg className="view-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z" />
                        </svg>
                      </div>
                      <div className="content">
                        <h3 id="portfolio-title">View Portfolio</h3>
                        <p>
                          Case studies featuring 300 percent retention and 20X customer value
                          growth
                        </p>
                      </div>
                      <button
                        onClick={() => setPortfolioOpen(true)}
                        className="view-button"
                        aria-label="View portfolio case studies"
                      >
                        View Projects
                      </button>
                    </div>
                  </article>
                </div>

                <div className="column-row">
                  <article className="resume-section" aria-labelledby="skills-title">
                    <div className="view-container">
                      <div className="icon-container" aria-hidden="true">
                        <svg className="view-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,17V16H9V14H13V15H15V16H13V17H11M13,13H11V12H13V13M15,11H13V10H15V11M11,11H9V10H11V11M15,9H9V8H15V9Z" />
                        </svg>
                      </div>
                      <div className="content">
                        <h3 id="skills-title">Skills and Expertise</h3>
                        <p>
                          Strategic planning, SEO, MarTech integration, and revenue optimization
                        </p>
                      </div>
                      <a href="#skills" className="view-button" aria-label="View skills breakdown">
                        View Skills
                      </a>
                    </div>
                  </article>

                  <article className="resume-section" aria-labelledby="contact-title">
                    <div className="view-container">
                      <div className="icon-container" aria-hidden="true">
                        <svg className="view-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z" />
                        </svg>
                      </div>
                      <div className="content">
                        <h3 id="contact-title">Get In Touch</h3>
                        <p>
                          Let us discuss how I can help drive measurable growth for your business
                        </p>
                      </div>
                      <button
                        onClick={() => setContactOpen(true)}
                        className="view-button"
                        aria-label="Contact Austin Santos"
                      >
                        Contact Me
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-skills" id="skills" aria-labelledby="skills-section-title">
        <div className="section-skills__content">
          <div className="section-skills__header">
            <h2 id="skills-section-title" className="section-skills__title">
              Core Competencies
            </h2>
          </div>

          <div className="skills-showcase">
            <article className="skills-category-card">
              <h3>Strategic Marketing</h3>
              <ul>
                <li>Growth Strategy Development</li>
                <li>Brand Positioning</li>
                <li>Digital Transformation</li>
                <li>Customer Acquisition</li>
                <li>Revenue Optimization</li>
              </ul>
            </article>

            <article className="skills-category-card">
              <h3>Analytics and Performance</h3>
              <ul>
                <li>Google Analytics</li>
                <li>Marketing Attribution</li>
                <li>KPI Development</li>
                <li>Data-Driven Decisions</li>
                <li>ROI Analysis</li>
              </ul>
            </article>

            <article className="skills-category-card">
              <h3>Digital Advertising</h3>
              <ul>
                <li>Paid Search - Google Ads</li>
                <li>Meta Advertising</li>
                <li>Programmatic Ads</li>
                <li>A/B Testing</li>
                <li>Campaign Optimization</li>
              </ul>
            </article>

            <article className="skills-category-card">
              <h3>SEO and Content</h3>
              <ul>
                <li>SEO Strategy - Ahrefs, SEMrush</li>
                <li>Content Distribution</li>
                <li>Copywriting</li>
                <li>Competitive Analysis</li>
                <li>Technical SEO</li>
              </ul>
            </article>

            <article className="skills-category-card">
              <h3>Marketing Technology</h3>
              <ul>
                <li>Salesforce and Pardot</li>
                <li>HubSpot</li>
                <li>Marketing Automation</li>
                <li>CRM Integration</li>
                <li>Zapier and APIs</li>
              </ul>
            </article>

            <article className="skills-category-card">
              <h3>Technical Skills</h3>
              <ul>
                <li>HTML, CSS, JavaScript</li>
                <li>React Development</li>
                <li>WordPress and Webflow</li>
                <li>Shopify and BigCommerce</li>
                <li>Google Workspace</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section-values__content">
        <div className="section-values__header">
          <h2 className="section-values__title">Core Values</h2>
        </div>
        <div className="section-values__body">
          <div className="section-values__column">
            <p className="section-values__text">
              Living in congruence with my values is essential. My values act as a compass, guiding
              my decisions and actions, ensuring integrity and authenticity. Empathy is at the
              heart of my values, helping me connect deeply with others. Integrity shapes my
              actions, promoting honesty and transparency. Growth and learning drive me to
              continuously improve.
            </p>
          </div>
          <div className="section-values__column">
            <p className="section-values__text">
              Using my values to dictate my actions creates harmony and fulfillment. Prioritizing
              balance and well-being ensures sustained productivity and happiness. This alignment
              enables me to pursue goals with clear purpose. In my professional journey, these
              values have led to strong client relationships and significant achievements,
              positively impacting those I interact with.
            </p>
          </div>
        </div>
      </section>

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
              style={{ padding: ".75rem 0", borderTop: "1px solid rgba(206,190,255,.2)" }}
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
                  Executed <strong>150+</strong> integrated B2B campaigns (SEO/email/PPC) delivering
                  consistent <strong>8% organic growth</strong>.
                </li>
                <li>
                  Retention model &amp; service ecosystem overhaul: <strong>10×</strong> content
                  engagement and <strong>500%</strong> potential portfolio value acceleration.
                </li>
              </ul>
            </div>

            <div
              className="stack"
              style={{ padding: ".75rem 0", borderTop: "1px solid rgba(206,190,255,.2)" }}
            >
              <p style={{ margin: 0, color: "#fff" }}>
                <strong>Senior Marketing Executive</strong> · Xuberan Digital · Roanoke, Texas ·{" "}
                <em>Jul 2021 – Present</em>
              </p>
              <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                <li>
                  Multi-platform MarTech integration → <strong>$150k</strong> efficiency, conversions
                  from <strong>3%</strong> → <strong>9%</strong>.
                </li>
                <li>
                  Acquisition framework: <strong>+80% YoY leads</strong>, <strong>80% retention</strong>,{" "}
                  <strong>$20M</strong> pipeline.
                </li>
                <li>Data-driven revenue programs → ~<strong>20%</strong> loading lift.</li>
              </ul>
            </div>

            <div
              className="stack"
              style={{ padding: ".75rem 0", borderTop: "1px solid rgba(206,190,255,.2)" }}
            >
              <p style={{ margin: 0, color: "#fff" }}>
                <strong>Sales &amp; Marketing Operations Director</strong> · Sunday Roast · Lindsay,
                Ontario · <em>Jan 2021 – Apr 2022</em>
              </p>
              <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                <li>
                  Product expansion + SEO org → pipeline <strong>+80%</strong>, <strong>$1M+</strong>{" "}
                  revenue @ <strong>50%</strong> margin.
                </li>
                <li>CAC reduced <strong>20%</strong> via systemization &amp; infra upgrades.</li>
                <li>Owned ops; managed <strong>$500k</strong> marketing budget.</li>
              </ul>
            </div>

            <div
              className="stack"
              style={{ padding: ".75rem 0", borderTop: "1px solid rgba(206,190,255,.2)" }}
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
            style={{ borderTop: "1px solid rgba(206,190,255,.2)", paddingTop: ".75rem" }}
          >
            <h4 id="edu-h" style={{ marginBottom: ".25rem", color: "#fff" }}>
              Education
            </h4>
            <ul className="stack" style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>
                <strong>B.A., Interdisciplinary</strong> · Liberty University · Mar 2018
              </li>
              <li>
                <strong>Digital Marketing: CE, Social, Planning &amp; Analytics</strong> · Columbia
                University · May 2021
              </li>
            </ul>
          </section>

          <section
            className="stack"
            aria-labelledby="skills-h"
            style={{ borderTop: "1px solid rgba(206,190,255,.2)", paddingTop: ".75rem" }}
          >
            <h4 id="skills-h" style={{ marginBottom: ".25rem", color: "#fff" }}>
              Skills
            </h4>
            <p style={{ margin: 0 }}>
              Strategic Planning · Brand Positioning · Digital Transformation · Campaign Integration ·
              Analytics &amp; Performance · Attribution · KPI Dev · Paid Search · Programmatic · A/B
              Testing · Content Strategy · SEO · Email · Lifecycle · Personalization · Acquisition ·
              CRO · Retention · MarTech · CRM · Automation · Budget &amp; ROI · Cross-functional
              Leadership.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Tools:</strong> Salesforce · Pardot · HubSpot · GA · Looker Studio · Ahrefs ·
              SEMrush · Google Ads · Meta Ads · Apollo · Outreach · Zapier · ClickUp · Asana · Monday ·
              HTML · CSS · React · Webflow · Shopify · WordPress · BigCommerce · Magento.
            </p>
          </section>
        </article>
      </Modal>

      <PortfolioModal isOpen={portfolioOpen} onClose={() => setPortfolioOpen(false)} />
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </main>
  );
}
