import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./declaration-rite-strategic-path.module.css";

export const metadata: Metadata = {
  title: "Strategic Path Declaration - Choose the Path",
  description:
    "Integrate everything into a single execution plan and choose your path: solo build or strategic partnership. Complete the Strategic Path Declaration in 30-35 minutes.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/declaration-rite-strategic-path/",
  },
};

export default function StrategicPathDeclarationPage() {
  const product = PRODUCTS["declaration-rite-strategic-path"];

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
            Strategic Path Declaration
            <span className={styles.titleAccent}>Choose the Path</span>
          </h1>

          <p className={styles.heroDescription}>
            Synthesize everything into a unified plan, compare solo vs partnership economics,
            and commit to a clear execution path.
          </p>

          <div className={styles.heroMicrocopy}>
            Complete the declaration in 30-35 minutes and receive your Strategic Path document instantly.
          </div>

          <a href="#purchase" className={styles.heroCta}>
            <span>Start the Strategic Path Declaration</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>12-15 Page Strategy</span>
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
              Strategic Path integrates your full work across Rite I, Rite II, and prior declarations.
              Completing them first is highly recommended but not required.
            </p>
            <div className={styles.prereqLinks}>
              <Link href="/products/perception">View Rite I: Perception</Link>
              <Link href="/products/orientation">View Rite II: Orientation</Link>
              <Link href="/products/declaration-rite-life-vision">View Life Vision Declaration</Link>
              <Link href="/products/declaration-rite-business-model">View Business Model Declaration</Link>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What You Will Decide</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Unified Strategy</h3>
              <p className={styles.featureDescription}>
                Integrate Perception, Orientation, and Declarations into one plan.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>12-Month Roadmap</h3>
              <p className={styles.featureDescription}>
                Build a phased execution roadmap with concrete milestones.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Solo vs Partnership</h3>
              <p className={styles.featureDescription}>
                Compare economics, timelines, and risk with clarity.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Values-Based Decision</h3>
              <p className={styles.featureDescription}>
                Ensure the chosen path honors your core values and capacity.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Execution Commitments</h3>
              <p className={styles.featureDescription}>
                Lock in next actions, accountability, and decision timelines.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Final Declaration</h3>
              <p className={styles.featureDescription}>
                Sign a Strategic Path commitment and move forward decisively.
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

            <h2 className={styles.purchaseTitle}>Start the Strategic Path Declaration</h2>

            <div className={styles.price}>
              <span className={styles.priceAmount}>$9</span>
              <span className={styles.pricePeriod}>one-time</span>
            </div>

            <ul className={styles.purchaseFeatures}>
              <li>✓ Integrated life + business strategy</li>
              <li>✓ 12-month execution roadmap</li>
              <li>✓ Solo vs partnership economics</li>
              <li>✓ Values-based decision framework</li>
              <li>✓ 12-15 page Strategic Path Declaration PDF</li>
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
