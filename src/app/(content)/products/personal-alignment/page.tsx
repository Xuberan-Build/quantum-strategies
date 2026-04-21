import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./personal-alignment.module.css";

export const metadata: Metadata = {
  title: "Personal Alignment Orientation - Discover Your Life Purpose",
  description:
    "Uncover your core values, life purpose, and authentic self using your Astrology & Human Design. Know who you're designed to be before you decide what to build—in 20 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/personal-alignment/",
  },
};

export default function PersonalAlignmentPage() {
  const product = PRODUCTS['personal-alignment'];

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
          <div className={styles.badge}>Personal Alignment Orientation</div>

          <h1 className={styles.heroTitle}>
            Discover Your Life Purpose
            <span className={styles.titleAccent}>Through Your Cosmic Design</span>
          </h1>

          <p className={styles.heroDescription}>
            Uncover your authentic core values, natural energy architecture, and Life's Task.
            <br />
            Know who you're designed to be before you decide what to build.
          </p>

          <div className={styles.heroMicrocopy}>
            Get crystal clarity on your purpose in 20 minutes using your Astrology & Human Design blueprint.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Get Your Personal Alignment Blueprint</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Personalized Blueprint</span>
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
              <h3 className={styles.featureTitle}>Core Values Discovery</h3>
              <p className={styles.featureDescription}>
                Extract your authentic values from your own words—not what you were taught, but what genuinely drives you.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Energy Architecture</h3>
              <p className={styles.featureDescription}>
                Understand your unique energy design and how to structure life for sustainable vitality and flow.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Identity Evolution</h3>
              <p className={styles.featureDescription}>
                Validate your growth journey—where you've been, where you are, and who you're becoming next.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Life's Task Clarity</h3>
              <p className={styles.featureDescription}>
                Discover your unique calling and what you're here to do based on recurring themes in your chart.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Astrology & Human Design</h3>
              <p className={styles.featureDescription}>
                Your personal alignment mapped through Sun/Moon/Rising, Venus, Saturn, North Node, and HD type.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Instant Results</h3>
              <p className={styles.featureDescription}>
                Complete the interactive experience in 20 minutes and get your Personal Alignment Blueprint immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Purchase Section */}
      <section id="purchase" className={styles.purchase}>
        <div className={styles.container}>
          <div className={styles.purchaseCard}>
            <div className={styles.purchaseBadge}>Foundation Product</div>

            <h2 className={styles.purchaseTitle}>Get Your Personal Alignment Blueprint</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$7</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Discover your authentic core values (not what you were taught)</li>
              <li>✓ Understand your unique energy architecture</li>
              <li>✓ Clarify your Life's Task and calling</li>
              <li>✓ Personal alignment blueprint worth $500 of clarity</li>
              <li>✓ Instant access, complete in 20 minutes</li>
              <li>✓ One-time payment, no recurring fees</li>
            </ul>

            {/* Stripe Checkout */}
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
              <h3 className={styles.faqQuestion}>What is Personal Alignment Orientation?</h3>
              <p className={styles.faqAnswer}>
                It's an interactive blueprint experience that analyzes your Astrology and Human Design to help you discover who you are at your core. You'll uncover your authentic values, energy design, identity evolution, and Life's Task—all aligned with your cosmic blueprint.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How does it work?</h3>
              <p className={styles.faqAnswer}>
                After purchase, you'll receive instant access to an interactive experience. You'll upload your birth chart, reflect on your values and energy patterns, and receive a Personal Alignment Blueprint in about 20 minutes. Everything is delivered immediately—no waiting.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What exactly will I learn?</h3>
              <p className={styles.faqAnswer}>
                You'll discover your core identity (Sun/Moon/Rising + HD type), authentic value system, energy architecture, identity evolution, life vision, and your unique Life's Task. You'll also get concrete alignment actions to close the gap between who you are and who you're becoming.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How is this different from Business Alignment Orientation?</h3>
              <p className={styles.faqAnswer}>
                Personal Alignment is about WHO YOU ARE (values, purpose, identity). Business Alignment is about WHAT YOU BUILD (offers, pricing, strategy). Start with Personal Alignment to build your foundation, then move to Business Alignment to monetize your purpose.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need to know my birth time?</h3>
              <p className={styles.faqAnswer}>
                Yes, you'll need your birth date, time, and location to get the most accurate reading. If you don't have your exact birth time, you can still participate, but some insights (like Rising sign and house placements) may be less precise.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What if I don't have my birth chart yet?</h3>
              <p className={styles.faqAnswer}>
                You can generate your free birth chart at astro.com or astro-seek.com, and your Human Design chart at jovianarchive.com or mybodygraph.com. Have both ready before starting the experience.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
