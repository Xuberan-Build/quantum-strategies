import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./brand-alignment.module.css";

export const metadata: Metadata = {
  title: "Brand Alignment Orientation - Unify Who You Are with How You Show Up",
  description:
    "Transform personal waveform into coherent brand strategy. 8-step orientation to align your authentic self with your brand expression.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/brand-alignment/",
  },
};

export default function BrandAlignmentPage() {
  const product = PRODUCTS['brand-alignment'];
  return (
    <div className={styles.page}>
      <Navbar showProductCTA={true} productCTAText="Get Your Blueprint" productCTAHref="#purchase" />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gridOverlay}></div>
          <div className={styles.radialGlow}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.badge}>Brand Alignment Orientation</div>

          <h1 className={styles.heroTitle}>
            Unify Who You Are
            <span className={styles.titleAccent}>with How You Show Up</span>
          </h1>

          <p className={styles.heroDescription}>
            Transform personal waveform into coherent brand strategy.
            <br />
            Where authentic self meets market positioning—no pretense.
          </p>

          <div className={styles.heroMicrocopy}>
            8-step orientation connecting your chart placements to visual frequency, messaging coherence, and market expression.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Begin Orientation</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>25-30 Minutes</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Chart-Based Strategy</span>
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
          <h2 className={styles.sectionTitle}>What's Included</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Brand Essence & Positioning</h3>
              <p className={styles.featureDescription}>
                Synthesize your core waveform into authentic brand positioning connected to your chart placements.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Visual Frequency</h3>
              <p className={styles.featureDescription}>
                Translate chart energy into visual brand recommendations—colors, imagery, design language aligned with your frequency.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Messaging Coherence</h3>
              <p className={styles.featureDescription}>
                Map your communication style from chart placements. Define tone, voice, and messaging patterns.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Market Expression</h3>
              <p className={styles.featureDescription}>
                Connect personal alignment to market positioning where your authentic waveform meets audience needs.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Alignment Gap Analysis</h3>
              <p className={styles.featureDescription}>
                Identify where your brand expression diverges from your chart frequency with concrete action steps.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Implementation Framework</h3>
              <p className={styles.featureDescription}>
                Practical next steps to embody this brand alignment in your business, content, and client experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Purchase Section */}
      <section id="purchase" className={styles.purchase}>
        <div className={styles.container}>
          <div className={styles.purchaseCard}>
            <div className={styles.purchaseBadge}>Limited Time Offer</div>

            <h2 className={styles.purchaseTitle}>Get Your Brand Alignment Blueprint</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$7</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Complete brand alignment blueprint from your chart</li>
              <li>✓ Visual frequency & messaging coherence analysis</li>
              <li>✓ Brand-self alignment gap identification</li>
              <li>✓ Market positioning strategy</li>
              <li>✓ Implementation framework with action steps</li>
              <li>✓ Instant access, complete in 25-30 minutes</li>
            </ul>

            {/* Stripe Checkout */}
            <StripeCheckout
              paymentLink={product.stripePaymentLink}
              productName={product.name}
              price={product.price}
              productSlug={product.slug}
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
              <h3 className={styles.faqQuestion}>What is Brand Alignment Orientation?</h3>
              <p className={styles.faqAnswer}>
                An 8-step interactive experience analyzing your Astrology and Human Design to create a unified brand blueprint. You'll discover how to align your authentic waveform with your brand expression, messaging, and market positioning.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How is this different from a rebrand?</h3>
              <p className={styles.faqAnswer}>
                This isn't about changing your brand—it's about achieving coherence between who you are and how you show up. We map your chart frequency to brand strategy, not force you into a template.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                A comprehensive Brand Alignment Blueprint covering: Brand Essence & Positioning, Visual Frequency, Messaging Coherence, Market Expression, Alignment Gaps, and an Implementation Framework.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need design experience?</h3>
              <p className={styles.faqAnswer}>
                No. This orientation focuses on strategic brand alignment, not design execution. You'll receive direction on colors, messaging, and positioning that you can implement yourself or share with a designer.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Plan for 25-30 minutes to complete all 8 steps. You'll receive your Brand Alignment Blueprint immediately upon completion.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What if I need help?</h3>
              <p className={styles.faqAnswer}>
                Email us anytime at support@quantumstrategies.com. We're here to help you achieve brand coherence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <div className={styles.container}>
          <h2 className={styles.footerCtaTitle}>Ready for Brand Coherence?</h2>
          <p className={styles.footerCtaText}>
            Your brand alignment blueprint is one click away.
          </p>
          <a href="#purchase" className={styles.footerCtaButton}>
            Begin Orientation
          </a>
        </div>
      </section>
    </div>
  );
}
