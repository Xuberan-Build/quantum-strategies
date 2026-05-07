import { Metadata } from "next";
import Navbar from "@/components/navigation/Navbar";
import BetaEnrollmentForm from "@/components/beta/BetaEnrollmentForm";
import styles from "./beta.module.css";

export const metadata: Metadata = {
  title: "Beta Program - Quantum Strategies Three Rites",
  description:
    "Join the Founding Circle for the Three Rites journey. Get free access to all 11 products, shape the future of Quantum Strategies, and become a Founding Member for just $60.",
  robots: { index: false, follow: false },
};

export default function BetaPage() {
  return (
    <div className={styles.page}>
      <Navbar showProductCTA={true} productCTAText="Join Beta Program" productCTAHref="#enroll" />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gridOverlay}></div>
          <div className={styles.radialGlow}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.badge}>Founding Circle - Beta Program</div>

          <h1 className={styles.heroTitle}>
            Shape the Future of Quantum Strategies
            <span className={styles.titleAccent}>Join the Three Rites Beta Program</span>
          </h1>

          <p className={styles.heroDescription}>
            Experience all 11 products free. Share your insights. Become a Founding Member.
            <br />
            6-week journey through Perception, Orientation, and Declaration.
          </p>

          <div className={styles.heroMicrocopy}>
            Your feedback will shape the final product experience for thousands of entrepreneurs.
          </div>

          <a href="#enroll" className={styles.heroCta}>
            <span>Join the Beta Program (Free Access)</span>
          </a>

          <div className={styles.trustIndicators}>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>11 Products Free</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>6-Week Journey</span>
            </div>
            <div className={styles.indicator}>
              <span className={styles.indicatorText}>Founding Member Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.features}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What's Included in the Beta</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Rite I: Perception (5 Scans)</h3>
              <p className={styles.featureDescription}>
                Signal Awareness • Value Pattern Decoder • Boundary & Burnout • Money Signal • Competence Mapping
                <br /><br />
                <strong>Value: $15</strong> (5 scans × $3 each)
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Rite II: Orientation (3 Blueprints)</h3>
              <p className={styles.featureDescription}>
                Personal Alignment • Business Alignment • Brand Alignment
                <br /><br />
                <strong>Value: $21</strong> (3 blueprints × $7 each)
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Rite III: Declaration (3 Declarations)</h3>
              <p className={styles.featureDescription}>
                Life Vision Declaration • Business Model Declaration • Strategic Path Declaration
                <br /><br />
                <strong>Value: $27</strong> (3 declarations × $9 each)
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>All 14 Deliverables</h3>
              <p className={styles.featureDescription}>
                Professional PDF reports, blueprints, and declarations personalized to your Astrology & Human Design.
                <br /><br />
                <strong>Total Value: $60+</strong>
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Your Voice Shapes the Product</h3>
              <p className={styles.featureDescription}>
                Quick feedback surveys after each product (2-7 minutes). Your insights directly improve the experience for future users.
              </p>
            </div>

            <div className={styles.featureCard}>
              <h3 className={styles.featureTitle}>Founding Member Priority</h3>
              <p className={styles.featureDescription}>
                First access to new features, priority support, and exclusive Founding Member community access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>How the Beta Program Works</h2>

          <div className={styles.timeline}>
            <div className={styles.timelineItem}>
              <div className={styles.timelineNumber}>1</div>
              <div className={styles.timelineContent}>
                <h3 className={styles.timelineTitle}>Enroll (Right Now)</h3>
                <p className={styles.timelineDescription}>
                  Sign up below. Instant access to all 11 products. No payment required.
                </p>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineNumber}>2</div>
              <div className={styles.timelineContent}>
                <h3 className={styles.timelineTitle}>Weeks 1-2: Rite I - Perception</h3>
                <p className={styles.timelineDescription}>
                  Complete 5 quick scans. Recalibrate your signal, values, boundaries, money mindset, and competence zones.
                  Share brief feedback after each (2 min).
                </p>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineNumber}>3</div>
              <div className={styles.timelineContent}>
                <h3 className={styles.timelineTitle}>Weeks 3-4: Rite II - Orientation</h3>
                <p className={styles.timelineDescription}>
                  Get 3 comprehensive blueprints (8-10 pages each) for your personal life, business strategy, and brand.
                  Share feedback on depth and actionability (3 min each).
                </p>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineNumber}>4</div>
              <div className={styles.timelineContent}>
                <h3 className={styles.timelineTitle}>Weeks 5-6: Rite III - Declaration</h3>
                <p className={styles.timelineDescription}>
                  Receive 3 strategic declarations (4-15 pages each) to lock in your vision, business model, and path forward.
                  Final feedback on commitment clarity.
                </p>
              </div>
            </div>

            <div className={styles.timelineItem}>
              <div className={styles.timelineNumber}>5</div>
              <div className={styles.timelineContent}>
                <h3 className={styles.timelineTitle}>Completion: Founding Member Invitation</h3>
                <p className={styles.timelineDescription}>
                  Receive your compiled journey summary (PDF). Founding Member access offered at $60 (minus any à la carte purchases you made).
                  Optional 1-on-1 call to discuss your journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We're Looking For */}
      <section className={styles.criteria}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What We're Looking For</h2>

          <div className={styles.criteriaGrid}>
            <div className={styles.criteriaItem}>
              <div className={styles.criteriaIcon}>✍️</div>
              <h3 className={styles.criteriaTitle}>Thoughtful Feedback</h3>
              <p className={styles.criteriaDescription}>
                You're willing to share honest, detailed insights about what works and what doesn't.
              </p>
            </div>

            <div className={styles.criteriaItem}>
              <div className={styles.criteriaIcon}>🎯</div>
              <h3 className={styles.criteriaTitle}>Commitment to Complete</h3>
              <p className={styles.criteriaDescription}>
                You'll finish all three Rites (11 products) within the 6-week timeframe.
              </p>
            </div>

            <div className={styles.criteriaItem}>
              <div className={styles.criteriaIcon}>🚀</div>
              <h3 className={styles.criteriaTitle}>Action-Oriented</h3>
              <p className={styles.criteriaDescription}>
                You're building something real and will actually use these insights to make decisions.
              </p>
            </div>

            <div className={styles.criteriaItem}>
              <div className={styles.criteriaIcon}>💬</div>
              <h3 className={styles.criteriaTitle}>Strong Communicator</h3>
              <p className={styles.criteriaDescription}>
                You can articulate what resonates, what confuses, and what gaps you notice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Enrollment Form */}
      <section id="enroll" className={styles.enrollment}>
        <div className={styles.container}>
          <div className={styles.enrollmentHeader}>
            <h2 className={styles.sectionTitle}>Join the Founding Circle</h2>
            <p className={styles.enrollmentSubtitle}>
              No payment required. Instant access to all 11 products upon approval.
            </p>
          </div>

          <BetaEnrollmentForm />
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.faq}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>

          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is there a limit on beta participants?</h3>
              <p className={styles.faqAnswer}>
                No. We're accepting all committed participants who are willing to provide thoughtful feedback.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>How much time does this require?</h3>
              <p className={styles.faqAnswer}>
                Each product takes 15-25 minutes to complete. Feedback surveys are 2-7 minutes each.
                Total time investment: ~5-7 hours over 6 weeks (self-paced).
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What happens after the beta?</h3>
              <p className={styles.faqAnswer}>
                You'll receive a Founding Member offer: lifetime access to all products for $60 (minus any à la carte purchases).
                No obligation to purchase.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Can I purchase products à la carte during the beta?</h3>
              <p className={styles.faqAnswer}>
                Yes! If you want to purchase individual products during your journey, those purchases count toward your $60 Founding Member total.
                Example: Buy $15 worth → final offer is $45.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What if I can't complete in 6 weeks?</h3>
              <p className={styles.faqAnswer}>
                The 6-week timeframe is a guideline. Your access doesn't expire. We just encourage completion within that window for momentum.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Do I need to know my birth time?</h3>
              <p className={styles.faqAnswer}>
                Yes, for your Human Design. If you don't know it, you can estimate or leave that section blank (Astrology only).
                However, you'll get more value with both Astrology and Human Design.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
