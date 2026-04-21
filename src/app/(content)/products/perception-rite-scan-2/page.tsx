import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./perception-rite-scan-2.module.css";

export const metadata: Metadata = {
  title: "Value Pattern Decoder - Reveal What You Truly Value",
  description:
    "Discover the gap between stated and revealed values and realign your business decisions. Complete the Value Pattern Decoder in about 20 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/perception-rite-scan-2/",
  },
};

export default function ValuePatternDecoderPage() {
  const product = PRODUCTS['perception-rite-scan-2'];

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
            Value Pattern Decoder
            <span className={styles.titleAccent}>Stated vs Revealed Values</span>
          </h1>

          <p className={styles.heroDescription}>
            You do not live by what you say you value. You live by what you repeat with your time,
            money, attention, and energy. This scan reveals the truth and the gap.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the scan in about 20 minutes and receive your Value Pattern Decoder Report instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Value Pattern Decoder</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Alignment Score</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>30-Day Plan</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Decode</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Stated vs Revealed Values</h3>
              <p className={styles.featureDescription}>
                Compare what you say matters to what your behavior proves you value.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Core State Discovery</h3>
              <p className={styles.featureDescription}>
                Trace your surface behaviors to the deeper intention you are really seeking.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Alignment Score</h3>
              <p className={styles.featureDescription}>
                Get a clear diagnostic of how aligned your time, money, attention, and energy are.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Value Hierarchy</h3>
              <p className={styles.featureDescription}>
                Identify your non-negotiable primary value and the supporting values beneath it.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Business Alignment</h3>
              <p className={styles.featureDescription}>
                See where your business model violates your values and how to correct it.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>30-Day Realignment Plan</h3>
              <p className={styles.featureDescription}>
                Walk away with a simple, staged plan to move your system back into alignment.
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

            <h2 className={styles.purchaseTitle}>Start the Value Pattern Decoder</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$3</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Reveal stated vs revealed values</li>
              <li>✓ Identify your core state and value hierarchy</li>
              <li>✓ Diagnose misalignment in business and life</li>
              <li>✓ Receive a 4-page Value Pattern Decoder Report</li>
              <li>✓ 30-day realignment plan included</li>
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
              <h3 className={styles.faqQuestion}>What is the Value Pattern Decoder?</h3>
              <p className={styles.faqAnswer}>
                It is a diagnostic scan that compares what you say you value with what your behavior proves
                you value. It reveals misalignment and gives a clear plan to realign.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Most people complete it in about 20 minutes and receive the report immediately.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need to complete Scan 1 first?</h3>
              <p className={styles.faqAnswer}>
                It is recommended, but not required. Each scan can be taken on its own.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                You will receive a 4-page report with your alignment score, core state analysis,
                value hierarchy, and a 30-day realignment plan.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is this about business only?</h3>
              <p className={styles.faqAnswer}>
                No. It addresses both life and business decisions because values drive every system.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I do the next scan later?</h3>
              <p className={styles.faqAnswer}>
                Yes. You can take each scan on your own timeline.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
