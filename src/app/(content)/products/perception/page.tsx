import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import StripeCheckout from "@/components/products/StripeCheckout";
import { PRODUCTS } from "@/lib/constants/products";
import styles from "./perception.module.css";

export const metadata: Metadata = {
  title: "Rite I: Perception - Learn to See the System",
  description:
    "Five perception scans to help you move from ignorance to awareness. Learn to recognize the patterns, signals, and structures governing your reality.",
  alternates: {
    canonical: "https://quantumstrategies.online/products/perception/",
  },
};

export default function RiteIPerceptionPage() {
  const bundle = PRODUCTS['perception-rite-bundle'];

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
          <div className={styles.riteBadge}>RITE I: PERCEPTION</div>

          <h1 className={styles.heroTitle}>
            Learn to See the System
            <span className={styles.titleAccent}>Ignorance → Awareness</span>
          </h1>

          <p className={styles.heroDescription}>
            Five diagnostic scans that recalibrate your consciousness from effect to cause.
            See the patterns, signals, and structures you have been blind to.
          </p>

          <div className={styles.heroMicrocopy}>
            15-20 minutes per scan. Instant reports. Total experience: 75-100 minutes.
          </div>

          <div className={styles.heroCtaGroup}>
            <a href="/products/perception-rite-scan-1" className={styles.heroCta}>
              <span>Start Scan 1: Signal Awareness</span>
            </a>
            <a href="#bundle" className={styles.heroCtaSecondary}>
              <span>Get All 5 Scans</span>
            </a>
          </div>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>5 Perception Scans</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Instant Access</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>PDF Reports</span>
            </div>
          </div>
        </div>
      </section>

      {/* What Perception Does */}
      <section className={styles.purpose}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What Perception Does</h2>
          <div className={styles.purposeGrid}>
            <div className={styles.purposeCard}>
              <h3 className={styles.purposeTitle}>The Shift</h3>
              <p className={styles.purposeDescription}>
                Perception moves you from <strong>effect</strong> to <strong>cause</strong>.
                You stop being blind to patterns and start seeing the system you are inside.
              </p>
            </div>
            <div className={styles.purposeCard}>
              <h3 className={styles.purposeTitle}>How It Fits</h3>
              <p className={styles.purposeDescription}>
                This is the first rite in the system. Rite I helps you <em>see</em> the patterns.
                Rite II helps you <em>locate yourself</em> within them. Rite III helps you <em>choose your direction</em>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Five Perception Scans */}
      <section className={styles.products}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>The Five Perception Scans</h2>
          <p className={styles.sectionSubtitle}>
            Each scan reveals a different layer of the system you're operating within.
          </p>

          <div className={styles.productGrid}>
            {/* Scan 1 */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Scan 1</div>
              <h3 className={styles.productTitle}>Signal Awareness</h3>
              <p className={styles.productDescription}>
                Discover what frequency you are broadcasting and why certain opportunities appear (or do not).
              </p>
              <ul className={styles.productFeatures}>
                <li>External signal recognition</li>
                <li>Opportunity magnet analysis</li>
                <li>Interference pattern detection</li>
                <li>7-day recalibration protocol</li>
              </ul>
              <a href="/products/perception-rite-scan-1" className={styles.productCta}>
                Start Scan 1
              </a>
            </div>

            {/* Scan 2 */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Scan 2</div>
              <h3 className={styles.productTitle}>Value Pattern Decoder</h3>
              <p className={styles.productDescription}>
                Reveal the gap between stated and revealed values and realign your operating system.
              </p>
              <ul className={styles.productFeatures}>
                <li>Stated vs revealed values</li>
                <li>Core state discovery</li>
                <li>Value hierarchy clarity</li>
                <li>30-day realignment plan</li>
              </ul>
              <a href="/products/perception-rite-scan-2" className={styles.productCta}>
                Start Scan 2
              </a>
            </div>

            {/* Scan 3 */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Scan 3</div>
              <h3 className={styles.productTitle}>Boundary & Burnout</h3>
              <p className={styles.productDescription}>
                Identify where your boundaries fail and redesign your energy system for sustainability.
              </p>
              <ul className={styles.productFeatures}>
                <li>Duty cycle analysis</li>
                <li>Boundary strength assessment</li>
                <li>Core state reversal</li>
                <li>30-90 day restoration plan</li>
              </ul>
              <a href="/products/perception-rite-scan-3" className={styles.productCta}>
                Start Scan 3
              </a>
            </div>

            {/* Scan 4 */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Scan 4</div>
              <h3 className={styles.productTitle}>Money Signal</h3>
              <p className={styles.productDescription}>
                Decode your pricing and money language to shift from scarcity to abundance signal.
              </p>
              <ul className={styles.productFeatures}>
                <li>Money belief audit</li>
                <li>Pricing signal analysis</li>
                <li>Language recalibration</li>
                <li>21-day money protocol</li>
              </ul>
              <a href="/products/perception-rite-scan-4" className={styles.productCta}>
                Start Scan 4
              </a>
            </div>

            {/* Scan 5 */}
            <div className={styles.productCard}>
              <div className={styles.productBadge}>Scan 5</div>
              <h3 className={styles.productTitle}>Competence Mapping</h3>
              <p className={styles.productDescription}>
                Map your genius zone and redesign your system around what only you can do.
              </p>
              <ul className={styles.productFeatures}>
                <li>Circle of competence clarity</li>
                <li>Time allocation audit</li>
                <li>Delegation priority matrix</li>
                <li>90-day implementation plan</li>
              </ul>
              <a href="/products/perception-rite-scan-5" className={styles.productCta}>
                Start Scan 5
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bundle Section */}
      <section id="bundle" className={styles.bundle}>
        <div className={styles.container}>
          <div className={styles.bundleCard}>
            <div className={styles.bundleBadge}>FULL SERIES</div>
            <h2 className={styles.bundleTitle}>Get All 5 Perception Scans</h2>
            <p className={styles.bundleDescription}>
              Complete the full Perception Rite and receive the Master Integration Report when all five scans are complete.
            </p>

            <div className={styles.bundlePrice}>
              <div className={styles.bundlePriceMain}>
                <span className={styles.bundlePriceAmount}>$12</span>
                <span className={styles.bundlePricePeriod}>one-time</span>
              </div>
              <div className={styles.bundlePriceSub}>
                <span className={styles.bundlePriceOriginal}>$15</span>
                <span className={styles.bundlePriceDiscount}>Save $3</span>
              </div>
            </div>

            <ul className={styles.bundleFeatures}>
              <li>✓ All five perception scans included</li>
              <li>✓ Five diagnostic reports + protocols</li>
              <li>✓ Master Integration Report after completion</li>
              <li>✓ Complete in 75-100 minutes total</li>
            </ul>

            <StripeCheckout
              productName={bundle?.name}
              price={bundle?.price}
              productSlug={bundle?.slug}
            />

            <div className={styles.guarantee}>
              Secure checkout • Instant access • No recurring charges
            </div>
          </div>
        </div>
      </section>

      {/* Why Perception Comes First */}
      <section className={styles.guide}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Why Perception Comes First</h2>
          <div className={styles.guideGrid}>
            <div className={styles.guideCard}>
              <h3 className={styles.guideTitle}>You Can't Navigate What You Can't See</h3>
              <p className={styles.guideDescription}>
                Before you can locate yourself (Rite II) or choose a direction (Rite III),
                you need to see the system you're operating within. Perception is the foundation.
              </p>
            </div>
            <div className={styles.guideCard}>
              <h3 className={styles.guideTitle}>Most People Are Blind</h3>
              <p className={styles.guideDescription}>
                They react to symptoms without seeing causes. They chase opportunities
                without recognizing patterns. They make decisions in the dark.
              </p>
            </div>
            <div className={styles.guideCard}>
              <h3 className={styles.guideTitle}>Awareness Changes Everything</h3>
              <p className={styles.guideDescription}>
                Once you see the patterns, you can't unsee them. Once you recognize the system,
                you can work with it instead of against it. Perception unlocks everything else.
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
            <div className={styles.riteCard} style={{ opacity: 0.5, cursor: 'default' }}>
              <div className={styles.riteCardBadge}>RITE I</div>
              <h3 className={styles.riteCardTitle}>Perception</h3>
              <p className={styles.riteCardDescription}>Learn to see the patterns</p>
              <div className={styles.riteCardStatusCurrent}>You're here</div>
            </div>

            <Link href="/products/orientation" className={styles.riteCard}>
              <div className={styles.riteCardBadge}>RITE II</div>
              <h3 className={styles.riteCardTitle}>Orientation</h3>
              <p className={styles.riteCardDescription}>Locate yourself within the system</p>
              <div className={styles.riteCardStatus}>Available Now</div>
            </Link>

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
