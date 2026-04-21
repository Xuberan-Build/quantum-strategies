import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./declaration-rite-business-model.module.css";

export const metadata: Metadata = {
  title: "Business Model Declaration - Design the System",
  description:
    "Map your business as a system, identify constraints, and design the ecosystem required to scale. Complete the Business Model Declaration in 30-35 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/declaration-rite-business-model/",
  },
};

export default function BusinessModelDeclarationPage() {
  const product = PRODUCTS["declaration-rite-business-model"];

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
            Business Model Declaration
            <span className={styles.titleAccent}>Design the System</span>
          </h1>

          <p className={styles.heroDescription}>
            Map your business as a system, find the constraint, and design the ecosystem
            required to reach your declared moonshot.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the declaration in 30-35 minutes and receive your Business Model Declaration instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Business Model Declaration</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>8-Page System Map</span>
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
              Business Model builds on Rite I (Perception), Rite II (Orientation), and Life Vision.
              Completing them first is highly recommended but not required.
            </p>
            <div className={styles.prereqLinks}>
              <Link href="/products/perception">View Rite I: Perception</Link>
              <Link href="/products/orientation">View Rite II: Orientation</Link>
              <Link href="/products/declaration-rite-life-vision">View Life Vision Declaration</Link>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Design</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Unit Economics</h3>
              <p className={styles.featureDescription}>
                Break down revenue, margins, CAC, LTV, and the gap to your target.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Constraint Diagnosis</h3>
              <p className={styles.featureDescription}>
                Identify the primary bottleneck limiting your entire system.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Feedback Loops</h3>
              <p className={styles.featureDescription}>
                Map virtuous and vicious cycles that drive or suppress growth.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>4-Pillar Ecosystem</h3>
              <p className={styles.featureDescription}>
                Design value creation, delivery, capture, and governance at scale.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Build Requirements</h3>
              <p className={styles.featureDescription}>
                Quantify systems, timelines, and costs required to execute.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Partnership Models</h3>
              <p className={styles.featureDescription}>
                Compare solo vs partnership economics with clear model options.
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

            <h2 className={styles.purchaseTitle}>Start the Business Model Declaration</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$9</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ System map of your current business</li>
              <li>✓ Constraint + feedback loop diagnosis</li>
              <li>✓ 4-pillar ecosystem design</li>
              <li>✓ Build requirements with timelines</li>
              <li>✓ 8-page Business Model Declaration PDF</li>
              <li>✓ Instant access, complete in 30-35 minutes</li>
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
