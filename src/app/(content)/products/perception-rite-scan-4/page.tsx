import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./perception-rite-scan-4.module.css";

export const metadata: Metadata = {
  title: "Money Signal Scan - Recalibrate Your Pricing and Language",
  description:
    "Decode your money beliefs, pricing signal, and sales language. Complete the Money Signal scan in 15-20 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/perception-rite-scan-4/",
  },
};

export default function MoneySignalPage() {
  const product = PRODUCTS['perception-rite-scan-4'];

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
            Money Signal Scan
            <span className={styles.titleAccent}>Scarcity to Abundance</span>
          </h1>

          <p className={styles.heroDescription}>
            The market responds to your money signal, not your value proposition.
            This scan reveals the beliefs, pricing, and language shaping your revenue.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the scan in 15-20 minutes and receive your Money Signal Report instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Money Signal Scan</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Belief Audit</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Pricing Signal</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>21-Day Protocol</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Recalibrate</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Money Belief Audit</h3>
              <p className={styles.featureDescription}>
                Complete rapid-fire prompts that expose your money signal tone.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Pricing Signal Analysis</h3>
              <p className={styles.featureDescription}>
                Diagnose what your current price communicates to the market.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Language Reframes</h3>
              <p className={styles.featureDescription}>
                Replace scarcity phrases with confident, aligned sales language.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Core State Reversal</h3>
              <p className={styles.featureDescription}>
                Uncover the core state beneath scarcity and install a new signal.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Evidence Mapping</h3>
              <p className={styles.featureDescription}>
                Build a database of proof that money already flows to you.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Pricing Recalibration</h3>
              <p className={styles.featureDescription}>
                Receive a recommended pricing shift and a confident sales script.
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

            <h2 className={styles.purchaseTitle}>Start the Money Signal Scan</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$3</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Diagnose your money signal tone</li>
              <li>✓ Analyze pricing and market response</li>
              <li>✓ Reframe scarcity language into abundance</li>
              <li>✓ Receive a 4-page Money Signal Report</li>
              <li>✓ 21-day recalibration protocol included</li>
              <li>✓ Instant access, complete in 15-20 minutes</li>
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
              <h3 className={styles.faqQuestion}>What is the Money Signal Scan?</h3>
              <p className={styles.faqAnswer}>
                It is a diagnostic that reveals how your beliefs, pricing, and language signal scarcity
                or abundance to the market.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Most people finish in 15-20 minutes and receive their report immediately.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Will this change my pricing?</h3>
              <p className={styles.faqAnswer}>
                The scan identifies what your pricing currently signals and recommends a confident shift.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                You receive a 4-page Money Signal Report plus a 21-day recalibration protocol.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I take this scan alone?</h3>
              <p className={styles.faqAnswer}>
                Yes. Each scan can be taken independently, though the full series compounds the effect.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What is the next scan?</h3>
              <p className={styles.faqAnswer}>
                Competence Mapping. It reveals your genius zone and what to delegate.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
