import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./perception-rite-scan-3.module.css";

export const metadata: Metadata = {
  title: "Boundary & Burnout Scan - Redesign Your Energy System",
  description:
    "Reveal your duty cycle, identify boundary failures, and restore sustainable energy. Complete the Boundary & Burnout scan in about 20 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/perception-rite-scan-3/",
  },
};

export default function BoundaryBurnoutPage() {
  const product = PRODUCTS['perception-rite-scan-3'];

  return (
    <div className={styles.page}>
      <Navbar showProductCTA={true} productCTAText="Start the Scan" productCTAHref="#purchase" />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gridOverlay}></div>
          <div className={styles.radialGlow}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.badge}>RITE I: PERCEPTION</div>

          <h1 className={styles.heroTitle}>
            Boundary & Burnout Scan
            <span className={styles.titleAccent}>Design Your Duty Cycle</span>
          </h1>

          <p className={styles.heroDescription}>
            Burnout is not about working too hard. It is about having no OFF switch.
            This scan maps your energy system and shows where boundaries are failing.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the scan in about 20 minutes and receive your restoration protocol instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Boundary & Burnout Scan</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Duty Cycle Map</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Boundary Profile</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>90-Day Plan</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Diagnose</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Always-On Pattern</h3>
              <p className={styles.featureDescription}>
                Identify what stays running in your mind even when you are supposed to be resting.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Duty Cycle Breakdown</h3>
              <p className={styles.featureDescription}>
                Map a full day into green, yellow, red, and black energy states.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Boundary Strengths</h3>
              <p className={styles.featureDescription}>
                Rate your time, energy, identity, and permission boundaries.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Core State Reversal</h3>
              <p className={styles.featureDescription}>
                Reveal the hidden intention behind your overdrive and dissolve the paradox.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Restoration Protocol</h3>
              <p className={styles.featureDescription}>
                Install one hard boundary, one recovery ritual, and remove one drain.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>90-Day Energy Redesign</h3>
              <p className={styles.featureDescription}>
                Walk away with a staged plan to rebalance your system for sustainability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Purchase Section */}
      <section id="purchase" className={styles.purchase}>
        <div className={styles.container}>
          <div className={styles.purchaseCard}>
            <div className={styles.purchaseBadge}>Rite I Scan</div>

            <h2 className={styles.purchaseTitle}>Start the Boundary & Burnout Scan</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$3</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Map your duty cycle and burnout pattern</li>
              <li>✓ Diagnose boundary weaknesses</li>
              <li>✓ Identify your core state and reversal</li>
              <li>✓ Receive a 5-page Boundary & Burnout Report</li>
              <li>✓ 30-90 day restoration protocol included</li>
              <li>✓ Instant access, complete in about 20 minutes</li>
            </ul>

            <StripeCheckout
              productName={product?.name}
              price={product?.price}
              productSlug={product?.slug}
            />

            <div className={styles.guarantee}>
              Secure checkout • Instant delivery • No recurring charges
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={styles.faq}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Common Questions</h2>

          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What is the Boundary & Burnout Scan?</h3>
              <p className={styles.faqAnswer}>
                It is a diagnostic that reveals what stays always on, what is shut down, and what is missing.
                You will see exactly where your boundaries are failing.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Most people finish in about 20 minutes and receive the report immediately.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is this just about work?</h3>
              <p className={styles.faqAnswer}>
                No. It covers work, identity, and recovery patterns that create burnout across life.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                You receive a 5-page report plus a staged restoration protocol for the next 90 days.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I take this scan alone?</h3>
              <p className={styles.faqAnswer}>
                Yes. Each scan stands on its own, even though the full series compounds the results.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What is the next scan?</h3>
              <p className={styles.faqAnswer}>
                Money Signal. It reveals how your pricing and money language are shaping outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
