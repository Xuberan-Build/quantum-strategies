import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./declaration.module.css";

export const metadata: Metadata = {
  title: "Rite III: Declaration - Bind Clarity to Chosen Trajectory",
  description:
    "Three strategic declarations to move from possibility to commitment. Declare your life vision, business model, and strategic path in 75-105 minutes total.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/declaration/",
  },
};

export default function RiteIIIDeclarationPage() {
  const bundleProduct = PRODUCTS["declaration-rite-bundle"];

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
          <div className={styles.riteBadge}>RITE III: DECLARATION</div>

          <h1 className={styles.heroTitle}>
            Bind Clarity to Chosen Trajectory
            <span className={styles.titleAccent}>Possibility → Commitment</span>
          </h1>

          <p className={styles.heroDescription}>
            Three declarations that collapse ambiguity into a specific, measurable, executable plan.
            <br />
            Declare your life vision, design your business model, and choose your strategic path.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete all three declarations in 75-105 minutes and walk away with strategic documents ready to execute.
          </div>

          <a href="#bundle" className={styles.heroCta}>
            <span>Get The Complete Declaration Bundle</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>3 Declarations</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>$24 Bundle</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* What Declaration Does */}
      <section className={styles.prereq}>
        <div className={styles.container}>
          <div className={styles.prereqCard}>
            <h2 className={styles.prereqTitle}>Recommended Prerequisites</h2>
            <p className={styles.prereqText}>
              Rite III is strongest after completing Rite I (Perception) and Rite II (Orientation).
              It is highly recommended but not required.
            </p>
            <div className={styles.prereqLinks}>
              <Link href="/products/perception">View Rite I: Perception</Link>
              <Link href="/products/orientation">View Rite II: Orientation</Link>
            </div>
          </div>
        </div>
      </section>

      {/* What Declaration Does */}
      <section className={styles.purpose}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What Declaration Does</h2>
          <div className={styles.purposeGrid}>
            <div className={styles.purposeCard}>
              <h3 className={styles.purposeTitle}>The Shift</h3>
              <p className={styles.purposeDescription}>
                Declaration moves you from <strong>clarity</strong> to <strong>commitment</strong>.
                You stop circling possibilities and choose a specific path, revenue target, and timeline.
              </p>
            </div>
            <div className={styles.purposeCard}>
              <h3 className={styles.purposeTitle}>How It Fits</h3>
              <p className={styles.purposeDescription}>
                This is the third rite in the system. Rite I helps you <em>see</em> the patterns.
                Rite II helps you <em>locate yourself</em> within them. Rite III helps you <em>declare your direction</em>.
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
            <h2 className={styles.bundleTitle}>The Complete Declaration Bundle</h2>
            <p className={styles.bundleDescription}>
              Get all three declarations and leave with a complete strategic plan and committed path forward.
            </p>

            <div className={styles.bundlePrice}>
              <span className={styles.bundlePriceStrike}>$27 individually</span>
              <div className={styles.bundlePriceMain}>
                <span className={styles.bundlePriceAmount}>$24</span>
                <span className={styles.bundlePricePeriod}>one-time</span>
              </div>
              <span className={styles.bundleSavings}>Save $3</span>
            </div>

            <ul className={styles.bundleFeatures}>
              <li>✓ Life Vision Declaration ($9 value)</li>
              <li>✓ Business Model Declaration ($9 value)</li>
              <li>✓ Strategic Path Declaration ($9 value)</li>
              <li>✓ Integrated strategic documents ready to execute</li>
              <li>✓ 75-105 minutes total to complete all three</li>
              <li>✓ Instant access, no recurring charges</li>
            </ul>

            <StripeCheckout
              paymentLink={bundleProduct?.stripePaymentLink}
              productName={bundleProduct?.name || "Declaration Rite Bundle"}
              price={bundleProduct?.price || 24}
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
            Prefer to start with just one? Each declaration is $9 individually.
          </p>
        </div>
      </section>

      {/* Individual Declarations */}
      <section className={styles.products}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>The Three Declarations</h2>
          <p className={styles.sectionSubtitle}>
            Each declaration can be purchased individually for $9, or get all three in the bundle above.
          </p>

          <div className={styles.productGrid}>
            {/* Life Vision */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Life Vision</div>
              <h3 className={styles.productTitle}>Life Vision Declaration</h3>
              <p className={styles.productDescription}>
                Declare your moonshot and calculate the real revenue required to fund the life you want.
                Align ambition with values and sign a personal manifesto.
              </p>
              <ul className={styles.productFeatures}>
                <li>Baseline vs freedom vs moonshot clarity</li>
                <li>Revenue requirement math</li>
                <li>Values and capacity alignment</li>
                <li>Personal manifesto + signature</li>
              </ul>
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>$9</span>
                <Link href="/products/declaration-rite-life-vision" className={styles.productButton}>
                  Learn More
                </Link>
              </div>
            </div>

            {/* Business Model */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Business Model</div>
              <h3 className={styles.productTitle}>Business Model Declaration</h3>
              <p className={styles.productDescription}>
                Map your business as a system, identify constraints, and design the ecosystem required to scale.
              </p>
              <ul className={styles.productFeatures}>
                <li>Unit economics + constraint analysis</li>
                <li>Feedback loops + leverage points</li>
                <li>4-pillar ecosystem design</li>
                <li>Build requirements + timelines</li>
              </ul>
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>$9</span>
                <Link href="/products/declaration-rite-business-model" className={styles.productButton}>
                  Learn More
                </Link>
              </div>
            </div>

            {/* Strategic Path */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Strategic Path</div>
              <h3 className={styles.productTitle}>Strategic Path Declaration</h3>
              <p className={styles.productDescription}>
                Integrate everything into one execution plan and choose your path: solo build or strategic partnership.
              </p>
              <ul className={styles.productFeatures}>
                <li>Integrated 12-month roadmap</li>
                <li>Solo vs partnership economics</li>
                <li>Values-based decision framework</li>
                <li>Final strategic commitment</li>
              </ul>
              <div className={styles.productFooter}>
                <span className={styles.productPrice}>$9</span>
                <Link href="/products/declaration-rite-strategic-path" className={styles.productButton}>
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
