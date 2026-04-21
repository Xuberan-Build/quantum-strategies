import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "../brand-alignment/brand-alignment.module.css";

export const metadata: Metadata = {
  title: "Business Alignment Orientation - Clarify Strategy and Offers",
  description:
    "Align your business model, offers, and pricing with your core waveform. Build a strategy that matches how you're designed to build.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/business-alignment/",
  },
};

export default function BusinessAlignmentPage() {
  const product = PRODUCTS['business-alignment'];
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
          <div className={styles.badge}>Business Alignment Orientation</div>

          <h1 className={styles.heroTitle}>
            Clarify What You Build
            <span className={styles.titleAccent}>and How You Monetize It</span>
          </h1>

          <p className={styles.heroDescription}>
            Align your business strategy, offers, and pricing with your authentic design.
            <br />
            Build a model that matches your natural operating rhythm.
          </p>

          <div className={styles.heroMicrocopy}>
            A focused 8-step orientation to map your business alignment in 20-30 minutes.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Begin Business Alignment</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>20-30 Minutes</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Strategic Clarity</span>
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
              <h3 className={styles.featureTitle}>Offer Architecture</h3>
              <p className={styles.featureDescription}>
                Design offers aligned with your chart energy and the way you naturally deliver value.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Pricing Clarity</h3>
              <p className={styles.featureDescription}>
                Set pricing and positioning that match your bandwidth and desired client experience.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Business Model Fit</h3>
              <p className={styles.featureDescription}>
                Match your revenue model to your natural workflow and decision-making rhythm.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Product Pathway</h3>
              <p className={styles.featureDescription}>
                Map the order of offers and delivery sequence that works for your energy type.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Capacity & Boundaries</h3>
              <p className={styles.featureDescription}>
                Identify capacity limits and build a sustainable scope that prevents burnout.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Strategic Alignment Plan</h3>
              <p className={styles.featureDescription}>
                Walk away with a concrete roadmap to align offers, pricing, and delivery.
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

            <h2 className={styles.purchaseTitle}>Get Your Business Alignment Blueprint</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$7</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Offer architecture aligned to your design</li>
              <li>✓ Pricing and positioning clarity</li>
              <li>✓ Business model fit analysis</li>
              <li>✓ Product pathway sequencing</li>
              <li>✓ Capacity boundaries and scope</li>
              <li>✓ 20-30 minute guided experience</li>
            </ul>

            {/* Stripe Checkout */}
            <StripeCheckout
              paymentLink={product?.stripePaymentLink}
              productName={product?.name || 'Business Alignment Orientation'}
              price={product?.price || 7}
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
              <h3 className={styles.faqQuestion}>What is Business Alignment Orientation?</h3>
              <p className={styles.faqAnswer}>
                An 8-step interactive experience to align your business model, offers, and pricing with your design. It helps you build a strategy that fits how you naturally operate.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need an existing business?</h3>
              <p className={styles.faqAnswer}>
                It works for both early-stage founders and established businesses. The focus is on strategic alignment, not your current revenue level.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What will I receive?</h3>
              <p className={styles.faqAnswer}>
                A Business Alignment Blueprint covering offers, pricing, model fit, and a clear roadmap to refine your strategy.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does it take?</h3>
              <p className={styles.faqAnswer}>
                Plan for 20-30 minutes to complete all 8 steps. You get your blueprint immediately.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Will this tell me what to sell?</h3>
              <p className={styles.faqAnswer}>
                It won&apos;t pick your niche for you, but it will clarify the offer shape, pricing, and delivery model that best fits your energy.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What if I need help?</h3>
              <p className={styles.faqAnswer}>
                Email us anytime at support@quantumstrategies.com. We&apos;re here to help you build with clarity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <div className={styles.container}>
          <h2 className={styles.footerCtaTitle}>Ready for Business Alignment?</h2>
          <p className={styles.footerCtaText}>
            Get your strategy aligned in one focused session.
          </p>
          <a href="#purchase" className={styles.footerCtaButton}>
            Begin Orientation
          </a>
        </div>
      </section>
    </div>
  );
}
