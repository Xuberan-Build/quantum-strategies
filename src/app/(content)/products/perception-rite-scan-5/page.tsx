import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./perception-rite-scan-5.module.css";

export const metadata: Metadata = {
  title: "Competence Mapping Scan - Identify Your Genius Zone",
  description:
    "Map your circle of competence, identify delegation priorities, and redesign your system around your genius. Complete the scan in 15-20 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/perception-rite-scan-5/",
  },
};

export default function CompetenceMappingPage() {
  const product = PRODUCTS['perception-rite-scan-5'];

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
            Competence Mapping Scan
            <span className={styles.titleAccent}>Your Genius Zone</span>
          </h1>

          <p className={styles.heroDescription}>
            You do not need to do everything. This scan reveals your circle of competence and shows
            what belongs inside your system vs what should be delegated.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the scan in 15-20 minutes and receive your Competence Mapping Report instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Competence Mapping Scan</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Genius Zone</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Delegation Matrix</span>
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
          <h2 className={styles.sectionTitle}>What You Will Clarify</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Excellence Pattern</h3>
              <p className={styles.featureDescription}>
                Identify what you do significantly better than most people.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Flow State Signals</h3>
              <p className={styles.featureDescription}>
                Reveal the work that puts you into effortless, high-performance focus.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Circle of Competence</h3>
              <p className={styles.featureDescription}>
                Map your inner, middle, and outer circles of competence clearly.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Time Allocation Audit</h3>
              <p className={styles.featureDescription}>
                See exactly where your week is spent and how far you are from optimal.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Delegation Priorities</h3>
              <p className={styles.featureDescription}>
                Identify the highest-value tasks to delegate or eliminate immediately.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>90-Day Realignment</h3>
              <p className={styles.featureDescription}>
                Build a staged plan to move 60%+ of your time into your genius zone.
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

            <h2 className={styles.purchaseTitle}>Start the Competence Mapping Scan</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$3</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Identify your genius zone and unfair advantage</li>
              <li>✓ Audit time spent inside vs outside competence</li>
              <li>✓ Build a delegation priority matrix</li>
              <li>✓ Receive a 5-page Competence Mapping Report</li>
              <li>✓ 90-day realignment plan included</li>
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
              <h3 className={styles.faqQuestion}>What is the Competence Mapping Scan?</h3>
              <p className={styles.faqAnswer}>
                It is a diagnostic that reveals your circle of competence and shows what to keep, delegate,
                automate, or eliminate.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Most people finish in 15-20 minutes and receive their report immediately.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is this only for founders?</h3>
              <p className={styles.faqAnswer}>
                It is designed for entrepreneurs and operators, but applies to anyone building systems.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                You receive a 5-page report plus a 90-day plan to shift time into your genius zone.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I take this scan alone?</h3>
              <p className={styles.faqAnswer}>
                Yes. Each scan can be taken individually, though the full series compounds the results.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What happens after this scan?</h3>
              <p className={styles.faqAnswer}>
                After completing all five scans, you will unlock the Master Integration Report.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
