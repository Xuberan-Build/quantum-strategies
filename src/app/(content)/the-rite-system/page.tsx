import { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navigation/Navbar";
import styles from "./rite-system.module.css";

export const metadata: Metadata = {
  title: "The Rite System - Three Stages of Strategic Transformation",
  description:
    "A three-part framework for strategic clarity: Perception (see patterns), Orientation (locate yourself), Declaration (choose direction). Learn how the Rite System works.",
  alternates: {
    canonical: "https://quantumstrategies.online/the-rite-system/",
  },
};

export default function RiteSystemPage() {
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
          <div className={styles.badge}>THE RITE SYSTEM</div>

          <h1 className={styles.heroTitle}>
            Three Stages of Strategic Transformation
            <span className={styles.titleAccent}>Perception → Orientation → Declaration</span>
          </h1>

          <p className={styles.heroDescription}>
            A systematic framework for moving from confusion to committed action.
            <br />
            Each rite builds on the last, taking you from blindness to mastery.
          </p>

          <a href="#rites" className={styles.heroCta}>
            <span>Explore the Rites</span>
          </a>
        </div>
      </section>

      {/* The Philosophy */}
      <section className={styles.philosophy}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>The Three-Rite Philosophy</h2>
          <div className={styles.philosophyContent}>
            <p className={styles.philosophyText}>
              Most people fail not from lack of effort, but from <strong>lack of seeing</strong>.
              They can't recognize the patterns governing their reality. They can't locate themselves within those patterns.
              And they can't choose a clear direction because they don't know where they stand.
            </p>
            <p className={styles.philosophyText}>
              The Rite System fixes this. It's a three-stage framework for strategic clarity:
            </p>
            <ul className={styles.philosophyList}>
              <li><strong>Rite I: Perception</strong> — Learn to see the patterns you've been blind to</li>
              <li><strong>Rite II: Orientation</strong> — Locate yourself within those patterns</li>
              <li><strong>Rite III: Declaration</strong> — Choose your direction with full commitment</li>
            </ul>
            <p className={styles.philosophyText}>
              Each rite is a transformation. Each builds on the last. You can't orient without perceiving.
              You can't declare without orienting. The system is sequential, intentional, and complete.
            </p>
          </div>
        </div>
      </section>

      {/* The Rites */}
      <section id="rites" className={styles.rites}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>The Three Rites</h2>

          <div className={styles.ritesGrid}>
            {/* Rite I: Perception */}
            <div className={styles.riteCard}>
              <div className={styles.riteNumber}>I</div>
              <h3 className={styles.riteTitle}>Perception</h3>
              <div className={styles.riteTransformation}>
                Ignorance → Awareness
              </div>
              <p className={styles.riteDescription}>
                Learn to see the patterns, signals, and structures governing your reality.
                Perception is the foundation—you can't navigate what you can't see.
              </p>
              <div className={styles.riteProducts}>
                <h4 className={styles.riteProductsTitle}>The 5 Scans:</h4>
                <ul className={styles.riteProductsList}>
                  <li>Signal Awareness Scan</li>
                  <li>Value Pattern Decoder</li>
                  <li>Boundary & Burnout Scan</li>
                  <li>Money Signal Scan</li>
                  <li>Competence Mapping Scan</li>
                </ul>
              </div>
              <Link href="/products/perception" className={styles.riteButtonActive}>
                Explore Perception
              </Link>
            </div>

            {/* Rite II: Orientation */}
            <div className={styles.riteCard}>
              <div className={styles.riteNumber}>II</div>
              <h3 className={styles.riteTitle}>Orientation</h3>
              <div className={styles.riteTransformation}>
                Confusion → Clarity
              </div>
              <p className={styles.riteDescription}>
                Locate yourself within the patterns. Map your position across personal, business, and brand domains.
                Know where you stand before deciding where to go.
              </p>
              <div className={styles.riteProducts}>
                <h4 className={styles.riteProductsTitle}>The 3 Orientations:</h4>
                <ul className={styles.riteProductsList}>
                  <li>Personal Alignment Orientation</li>
                  <li>Business Alignment Orientation</li>
                  <li>Brand Alignment Orientation</li>
                </ul>
              </div>
              <Link href="/products/orientation" className={styles.riteButtonActive}>
                Explore Orientation ($17 bundle)
              </Link>
            </div>

            {/* Rite III: Declaration */}
            <div className={styles.riteCard}>
              <div className={styles.riteNumber}>III</div>
              <h3 className={styles.riteTitle}>Declaration</h3>
              <div className={styles.riteTransformation}>
                Possibility → Commitment
              </div>
              <p className={styles.riteDescription}>
                Choose your direction with full conviction. Transform vague intention into committed action.
                This is where clarity becomes strategy.
              </p>
              <div className={styles.riteProducts}>
                <h4 className={styles.riteProductsTitle}>The 3 Declarations:</h4>
                <ul className={styles.riteProductsList}>
                  <li>Life Vision Declaration</li>
                  <li>Business Model Declaration</li>
                  <li>Strategic Path Declaration</li>
                </ul>
              </div>
              <Link href="/products/declaration" className={styles.riteButtonActive}>
                Explore Declaration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>How the System Works</h2>
          <div className={styles.processGrid}>
            <div className={styles.processCard}>
              <div className={styles.processNumber}>1</div>
              <h3 className={styles.processTitle}>Start with Perception</h3>
              <p className={styles.processDescription}>
                First, you need to see. Rite I teaches you to recognize the patterns, signals, and structures
                that have been invisible to you. You can't solve problems you can't see.
              </p>
            </div>

            <div className={styles.processArrow}>→</div>

            <div className={styles.processCard}>
              <div className={styles.processNumber}>2</div>
              <h3 className={styles.processTitle}>Then Orient Yourself</h3>
              <p className={styles.processDescription}>
                Once you can see, you need to know where you are. Rite II maps your position across
                personal, business, and brand domains. You can't navigate without knowing your starting point.
              </p>
            </div>

            <div className={styles.processArrow}>→</div>

            <div className={styles.processCard}>
              <div className={styles.processNumber}>3</div>
              <h3 className={styles.processTitle}>Finally, Declare Direction</h3>
              <p className={styles.processDescription}>
                With sight and position, you're ready to choose. Rite III transforms vague possibility into
                committed direction. This is where clarity becomes strategy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Where to Start */}
      <section className={styles.whereToStart}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Where Should You Start?</h2>
          <div className={styles.startGrid}>
            <div className={styles.startCard}>
              <h3 className={styles.startTitle}>If you can't see the patterns...</h3>
              <p className={styles.startDescription}>
                Start with <strong>Rite I: Perception</strong>. You're operating blind and need to develop
                pattern recognition first.
              </p>
              <Link href="/products/perception" className={styles.startButtonActive}>
                Explore Perception
              </Link>
            </div>

            <div className={`${styles.startCard} ${styles.startCardRecommended}`}>
              <div className={styles.recommendedBadge}>START HERE</div>
              <h3 className={styles.startTitle}>If you feel confused or misaligned...</h3>
              <p className={styles.startDescription}>
                Start with <strong>Rite II: Orientation</strong>. You can see some patterns but don't know
                where you stand. This is the most common starting point.
              </p>
              <Link href="/products/orientation" className={styles.startButtonActive}>
                Get Orientation Bundle ($17)
              </Link>
            </div>

            <div className={styles.startCard}>
              <h3 className={styles.startTitle}>If you know where you are but not where to go...</h3>
              <p className={styles.startDescription}>
                You'll need <strong>Rite III: Declaration</strong>. You have clarity on your position
                but haven't committed to a direction yet.
              </p>
              <Link href="/products/declaration" className={styles.startButtonActive}>
                Explore Declaration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faq}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Common Questions</h2>

          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I have to do all three rites?</h3>
              <p className={styles.faqAnswer}>
                No. Each rite is valuable on its own. But the system is designed to be sequential—each builds on the last.
                If you only do Orientation, you'll get clarity on where you stand. If you complete all three,
                you'll have a complete transformation from blindness to committed action.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I start with Rite II without doing Rite I first?</h3>
              <p className={styles.faqAnswer}>
                Yes. Rite II (Orientation) is the most common starting point and works perfectly standalone.
                Most people have developed enough perception through experience—they just need help locating themselves.
                You can always circle back to Rite I afterward.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How long does each rite take?</h3>
              <p className={styles.faqAnswer}>
                Each product within a rite takes 15–20 minutes to complete. Rite I has 5 scans, Rite II has 3 orientations, and Rite III has 3 declarations. You can work through them in one session or spread them out.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What's the difference between the rites and individual products?</h3>
              <p className={styles.faqAnswer}>
                Each rite is a category containing multiple products. For example, Rite II (Orientation) contains
                Personal Alignment, Business Alignment, and Brand Alignment. You can purchase individual products or the full bundle for each rite.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is there a bundle for all three rites?</h3>
              <p className={styles.faqAnswer}>
                Each rite has its own bundle. A complete three-rite bundle is coming — for now, start with the rite that matches where you are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to Begin?</h2>
            <p className={styles.ctaDescription}>
              All three rites are available now. Start where you are — perception, orientation, or declaration.
            </p>
            <Link href="/products/orientation" className={styles.ctaButton}>
              Start with Orientation ($17)
            </Link>
            <div className={styles.ctaMeta}>
              All rites available • Instant access • 15–20 min per product
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
