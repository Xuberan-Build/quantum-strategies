import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./declaration-rite-life-vision.module.css";

export const metadata: Metadata = {
  title: "Life Vision Declaration - Declare Your Moonshot",
  description:
    "Declare the revenue target and life vision you are committing to. Complete the Life Vision Declaration in 25-30 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/declaration-rite-life-vision/",
  },
};

export default function LifeVisionDeclarationPage() {
  const product = PRODUCTS["declaration-rite-life-vision"];

  return (
    <div className={styles.page}>
      <Navbar showProductCTA={true} productCTAText="Start the Declaration" productCTAHref="#purchase" />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gridOverlay}></div>
          <div className={styles.radialGlow}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.badge}>RITE III: DECLARATION</div>

          <h1 className={styles.heroTitle}>
            Life Vision Declaration
            <span className={styles.titleAccent}>Declare Your Moonshot</span>
          </h1>

          <p className={styles.heroDescription}>
            Stop guessing. Quantify the life you want, calculate the revenue it requires,
            and commit to a specific target and timeline.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the declaration in 25-30 minutes and receive your Life Vision Manifesto instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Life Vision Declaration</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>4-Page Manifesto</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Secure Payment</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.prereq}>
        <div className={styles.container}>
          <div className={styles.prereqCard}>
            <h2 className={styles.prereqTitle}>Recommended Prerequisites</h2>
            <p className={styles.prereqText}>
              Life Vision builds on Rite I (Perception) and Rite II (Orientation).
              Completing them first is highly recommended but not required.
            </p>
            <div className={styles.prereqLinks}>
              <Link href="/products/perception">View Rite I: Perception</Link>
              <Link href="/products/orientation">View Rite II: Orientation</Link>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Declare</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Moonshot Target</h3>
              <p className={styles.featureDescription}>
                Define baseline, freedom, and moonshot revenue levels with real numbers.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Revenue Requirement</h3>
              <p className={styles.featureDescription}>
                Calculate the true income required after taxes, expenses, and safety buffer.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Values Alignment</h3>
              <p className={styles.featureDescription}>
                Pressure-test your target against your core values and adjust if needed.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Capacity Reality Check</h3>
              <p className={styles.featureDescription}>
                Validate whether the target is feasible with your real work capacity.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Personal Manifesto</h3>
              <p className={styles.featureDescription}>
                Sign a declaration that defines who you are becoming and what you are building.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Next Steps</h3>
              <p className={styles.featureDescription}>
                Clear path forward into Business Model Declaration with quantified inputs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Purchase Section */}
      <section id="purchase" className={styles.purchase}>
        <div className={styles.container}>
          <div className={styles.purchaseCard}>
            <div className={styles.purchaseBadge}>Rite III Declaration</div>

            <h2 className={styles.purchaseTitle}>Start the Life Vision Declaration</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$9</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Baseline, freedom, and moonshot targets</li>
              <li>✓ Real revenue math with buffer + taxes</li>
              <li>✓ Values and capacity alignment checks</li>
              <li>✓ Signed personal manifesto</li>
              <li>✓ 4-page Life Vision Declaration PDF</li>
              <li>✓ Instant access, complete in 25-30 minutes</li>
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
    </div>
  );
}
