import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./orientation.module.css";

export const metadata: Metadata = {
  title: "Rite II: Orientation - Locate Yourself Within the System",
  description:
    "Three alignment orientations to help you move from confusion to clarity. Discover your personal, business, and brand alignment in 60 minutes total.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/orientation/",
  },
};

export default function RiteIIOrientationPage() {
  const bundleProduct = PRODUCTS['orientation-bundle'];

  return (
    <div className={styles.page}>
      <Navbar />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gridOverlay}></div>
          <div className={styles.radialGlow}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.riteBadge}>RITE II: ORIENTATION</div>

          <h1 className={styles.heroTitle}>
            Locate Yourself Within the System
            <span className={styles.titleAccent}>Confusion → Clarity</span>
          </h1>

          <p className={styles.heroDescription}>
            Three alignment orientations to map your complete position.
            <br />
            Know where you are before you decide where to go.
          </p>

          <div className={styles.heroMicrocopy}>
            Get crystal clarity on your personal, business, and brand alignment in 60 minutes total.
          </div>

          <a href="#bundle" className={styles.heroCta}>
            <span>Get The Complete Orientation Bundle</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>3 Orientations</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>$17 Bundle</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* What Orientation Does */}
      <section className={styles.purpose}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What Orientation Does</h2>
          <div className={styles.purposeGrid}>
            <div className={styles.purposeCard}>
              <h3 className={styles.purposeTitle}>The Shift</h3>
              <p className={styles.purposeDescription}>
                Orientation moves you from <strong>confusion</strong> to <strong>clarity</strong>.
                You'll stop wandering and start knowing exactly where you stand—personally, professionally, and publicly.
              </p>
            </div>
            <div className={styles.purposeCard}>
              <h3 className={styles.purposeTitle}>How It Fits</h3>
              <p className={styles.purposeDescription}>
                This is the second rite in the system. Rite I helps you <em>see</em> the patterns.
                Rite II helps you <em>locate yourself</em> within them. Rite III helps you <em>choose your direction</em>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bundle Offer */}
      <section id="bundle" className={styles.bundle}>
        <div className={styles.container}>
          <div className={styles.bundleCard}>
            <div className={styles.bundleBadge}>BEST VALUE</div>
            <h2 className={styles.bundleTitle}>The Complete Orientation Bundle</h2>
            <p className={styles.bundleDescription}>
              Get all three orientations and map your complete position across personal, business, and brand alignment.
            </p>

            <div className={styles.bundlePrice}>
              <span className={styles.bundlePriceStrike}>$21 individually</span>
              <div className={styles.bundlePriceMain}>
                <span className={styles.bundlePriceAmount}>$17</span>
                <span className={styles.bundlePricePeriod}>one-time</span>
              </div>
              <span className={styles.bundleSavings}>Save $4</span>
            </div>

            <ul className={styles.bundleFeatures}>
              <li>✓ Personal Alignment Orientation ($7 value)</li>
              <li>✓ Business Alignment Orientation ($7 value)</li>
              <li>✓ Brand Alignment Orientation ($7 value)</li>
              <li>✓ Complete position map across all three domains</li>
              <li>✓ 60 minutes total to complete all three</li>
              <li>✓ Instant access, no recurring charges</li>
            </ul>

            {/* Stripe Checkout */}
            <StripeCheckout
              paymentLink={bundleProduct?.stripePaymentLink}
              productName={bundleProduct?.name || 'Complete Orientation Bundle'}
              price={bundleProduct?.price || 17}
              productSlug={bundleProduct?.slug}
            />

            <div className={styles.guarantee}>
              Secure checkout • Instant delivery • No recurring charges
            </div>
          </div>
        </div>
      </section>

      {/* Individual Purchase Section */}
      <section id="purchase" className={styles.individualPurchase}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Or Purchase Individually</h2>
          <p className={styles.sectionSubtitle}>
            Prefer to start with just one? Each orientation is $7 individually.
          </p>
        </div>
      </section>

      {/* Individual Orientations */}
      <section className={styles.products}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>The Three Orientations</h2>
          <p className={styles.sectionSubtitle}>
            Each orientation can be purchased individually for $7, or get all three in the bundle above.
          </p>

          <div className={styles.productGrid}>
            {/* Personal Alignment */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Personal</div>
              <h3 className={styles.productTitle}>Personal Alignment Orientation</h3>
              <p className={styles.productDescription}>
                Discover your life purpose through your Astrology & Human Design.
                Uncover your core values, energy architecture, and Life's Task.
              </p>
              <ul className={styles.productFeatures}>
                <li>Core values discovery</li>
                <li>Energy architecture mapping</li>
                <li>Identity evolution tracking</li>
                <li>Life's Task clarity</li>
              </ul>
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>$7</span>
                <Link href="/products/personal-alignment" className={styles.productButton}>
                  Learn More
                </Link>
              </div>
            </div>

            {/* Business Alignment */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Business</div>
              <h3 className={styles.productTitle}>Business Alignment Orientation</h3>
              <p className={styles.productDescription}>
                Map your business model, offers, and pricing strategy.
                Understand what you're selling, who you're selling to, and how it all connects.
              </p>
              <ul className={styles.productFeatures}>
                <li>Business model clarity</li>
                <li>Offer structure mapping</li>
                <li>Pricing strategy alignment</li>
                <li>Market positioning</li>
              </ul>
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>$7</span>
                <Link href="/products/business-alignment" className={styles.productButton}>
                  Learn More
                </Link>
              </div>
            </div>

            {/* Brand Alignment */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Brand</div>
              <h3 className={styles.productTitle}>Brand Alignment Orientation</h3>
              <p className={styles.productDescription}>
                Unify who you are with how you show up.
                Create a brand identity that authentically represents your values and purpose.
              </p>
              <ul className={styles.productFeatures}>
                <li>Brand identity alignment</li>
                <li>Public persona mapping</li>
                <li>Messaging clarity</li>
                <li>Authentic positioning</li>
              </ul>
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>$7</span>
                <Link href="/products/brand-alignment" className={styles.productButton}>
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Selection Guide */}
      <section className={styles.guide}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Which Orientation Should You Start With?</h2>
          <div className={styles.guideGrid}>
            <div className={styles.guideCard}>
              <h3 className={styles.guideTitle}>Start with Personal</h3>
              <p className={styles.guideDescription}>
                If you're unclear on your values, purpose, or what drives you at a core level.
                This is the foundation—know yourself before you build anything.
              </p>
            </div>
            <div className={styles.guideCard}>
              <h3 className={styles.guideTitle}>Then Business</h3>
              <p className={styles.guideDescription}>
                If you know who you are but unclear on what you're building or selling.
                This maps your offers, pricing, and business model.
              </p>
            </div>
            <div className={styles.guideCard}>
              <h3 className={styles.guideTitle}>Finally Brand</h3>
              <p className={styles.guideDescription}>
                If you know yourself and your business but struggle with how you show up publicly.
                This unifies your identity with your public persona.
              </p>
            </div>
          </div>
          <div className={styles.guideRecommendation}>
            <strong>Recommended:</strong> Get the bundle and complete all three in sequence.
            You'll have a complete orientation map across all domains in one sitting.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faq}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Common Questions</h2>

          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What's the difference between the three orientations?</h3>
              <p className={styles.faqAnswer}>
                Personal Alignment focuses on WHO YOU ARE (values, purpose, identity).
                Business Alignment focuses on WHAT YOU BUILD (offers, pricing, strategy).
                Brand Alignment focuses on HOW YOU SHOW UP (messaging, positioning, public persona).
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Should I buy the bundle or individual orientations?</h3>
              <p className={styles.faqAnswer}>
                The bundle saves you $4 and gives you the complete picture. If you're only interested in one specific area,
                buy individually. But most people benefit from seeing how all three domains connect.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does each orientation take?</h3>
              <p className={styles.faqAnswer}>
                Each orientation takes about 20 minutes to complete. If you purchase the bundle,
                you can complete all three in one 60-minute session or spread them across multiple days.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What do I need to complete the orientations?</h3>
              <p className={styles.faqAnswer}>
                For Personal Alignment, you'll need your birth chart (astrology and Human Design).
                For Business and Brand Alignment, you'll need to reflect on your current business model and how you present yourself publicly.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What is the Rite System?</h3>
              <p className={styles.faqAnswer}>
                The Rite System is a three-part framework: Rite I (Perception) helps you see patterns,
                Rite II (Orientation) helps you locate yourself within those patterns,
                and Rite III (Declaration) helps you choose your direction. Orientation is the second rite.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I access these after purchase?</h3>
              <p className={styles.faqAnswer}>
                Yes! You get lifetime access to all orientations you purchase. You can revisit them anytime,
                create new versions to track your evolution, and reference your blueprints whenever needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-Linking to Other Rites */}
      <section className={styles.otherRites}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Explore the Other Rites</h2>
          <div className={styles.ritesGrid}>
            <Link href="/products/perception" className={styles.riteCard}>
              <div className={styles.riteCardBadge}>RITE I</div>
              <h3 className={styles.riteCardTitle}>Perception</h3>
              <p className={styles.riteCardDescription}>Learn to see the patterns</p>
              <div className={styles.riteCardStatus}>Coming Soon</div>
            </Link>

            <div className={styles.riteCard} style={{ opacity: 0.5, cursor: 'default' }}>
              <div className={styles.riteCardBadge}>RITE II</div>
              <h3 className={styles.riteCardTitle}>Orientation</h3>
              <p className={styles.riteCardDescription}>Locate yourself within the system</p>
              <div className={styles.riteCardStatusCurrent}>You're here</div>
            </div>

            <Link href="/products/declaration" className={styles.riteCard}>
              <div className={styles.riteCardBadge}>RITE III</div>
              <h3 className={styles.riteCardTitle}>Declaration</h3>
              <p className={styles.riteCardDescription}>Choose your direction</p>
              <div className={styles.riteCardStatus}>Coming Soon</div>
            </Link>
          </div>
          <div className={styles.ritesFooter}>
            <Link href="/the-rite-system" className={styles.ritesLink}>
              Learn more about The Rite System →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
