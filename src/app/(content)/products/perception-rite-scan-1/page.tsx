import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./perception-rite-scan-1.module.css";

export const metadata: Metadata = {
  title: "Signal Awareness Scan - Reveal Your Current Frequency",
  description:
    "Discover what signal you are broadcasting and why certain opportunities appear (or do not). Complete the Signal Awareness scan in 15-20 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/perception-rite-scan-1/",
  },
};

export default function SignalAwarenessPage() {
  const product = PRODUCTS['perception-rite-scan-1'];

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
            Signal Awareness Scan
            <span className={styles.titleAccent}>Reveal Your Current Frequency</span>
          </h1>

          <p className={styles.heroDescription}>
            Your life is not random. You are broadcasting a specific signal through your self-concept,
            attention, language, and actions. The world responds to THIS frequency.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the scan in 15-20 minutes and get your Signal Awareness Report instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Signal Awareness Scan</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Personalized Report</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Secure Payment</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Discover</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>External Signal</h3>
              <p className={styles.featureDescription}>
                Identify what people consistently come to you for and what that reveals about your signal.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Attractive Frequency</h3>
              <p className={styles.featureDescription}>
                Spot the opportunities that keep showing up and what they say about your current broadcast.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Interference Pattern</h3>
              <p className={styles.featureDescription}>
                Name the recurring challenge that follows you and the signal it is amplifying.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Narrative Frequency</h3>
              <p className={styles.featureDescription}>
                Reveal the story you are unconsciously living and how it shapes your decisions.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Authentic Frequency</h3>
              <p className={styles.featureDescription}>
                Identify what truly energizes you and the signal you want to amplify.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Recalibration Protocol</h3>
              <p className={styles.featureDescription}>
                Walk away with a 7-day protocol to align your signal with your desired identity.
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

            <h2 className={styles.purchaseTitle}>Start the Signal Awareness Scan</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$3</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Identify your current signal across four components</li>
              <li>✓ See the gap between stated identity and revealed behavior</li>
              <li>✓ Understand why certain opportunities appear (or do not)</li>
              <li>✓ Receive a 3-page Signal Awareness Report</li>
              <li>✓ 7-day recalibration protocol included</li>
              <li>✓ Instant access, complete in 15-20 minutes</li>
            </ul>

            <StripeCheckout
              paymentLink={product?.stripePaymentLink}
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
              <h3 className={styles.faqQuestion}>What is the Signal Awareness Scan?</h3>
              <p className={styles.faqAnswer}>
                It is a guided diagnostic that reveals the signal you are broadcasting through your
                self-concept, attention, language, and actions. You will see the pattern behind the
                opportunities you attract and the ones you miss.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Most people finish in 15-20 minutes and receive their report immediately after the final step.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need any prep?</h3>
              <p className={styles.faqAnswer}>
                No. This scan does not require charts or documents. Just answer the prompts honestly.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                You get a 3-page Signal Awareness Report plus a 7-day recalibration protocol to align your
                signal with your desired identity.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is this the full Rite I experience?</h3>
              <p className={styles.faqAnswer}>
                This is Scan 1 of Rite I: Perception. You can take each scan individually or complete all five
                for a full system-level view.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I do the next scan later?</h3>
              <p className={styles.faqAnswer}>
                Yes. You can purchase scans individually and complete them on your own timeline.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
