import type { Metadata } from "next";
import styles from "@/styles/pages/LegalPage.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const tocItems = [
  { id: "introduction", label: "Introduction" },
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "how-we-use", label: "How We Use Your Information" },
  { id: "how-we-share", label: "How We Share Your Information" },
  { id: "data-storage-security", label: "Data Storage and Security" },
  { id: "privacy-rights", label: "Your Privacy Rights" },
  { id: "international-transfers", label: "International Data Transfers" },
  { id: "children", label: "Children's Privacy" },
  { id: "cookies", label: "Cookies and Tracking Technologies" },
  { id: "third-party-links", label: "Third-Party Links" },
  { id: "ccpa", label: "California Privacy Rights (CCPA)" },
  { id: "gdpr", label: "European Privacy Rights (GDPR)" },
  { id: "ai", label: "AI and Automated Decision-Making" },
  { id: "briefings-portrait", label: "Personalized Briefings and the User Portrait" },
  { id: "changes", label: "Changes to This Privacy Policy" },
  { id: "contact", label: "Contact Us" },
  { id: "affiliate-privacy", label: "Affiliate Program Specific Privacy" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <h1>Privacy Policy</h1>
          <div className={styles.meta}>
            <span>Effective Date: May 26, 2026</span>
            <span>Last Updated: May 26, 2026</span>
          </div>
          <p>
            Welcome to Quantum Strategies ("we," "our," or "us"). We respect your privacy and are
            committed to protecting your personal information. This Privacy Policy explains how we
            collect, use, disclose, and safeguard your information when you use our website,
            services, and AI-powered products (collectively, the "Services").
          </p>
          <p>
            By accessing or using our Services, you agree to this Privacy Policy. If you do not
            agree with the terms of this Privacy Policy, please do not access or use our Services.
          </p>
        </div>
      </header>

      <div className={`container ${styles.layout}`}>
        <aside className={styles.toc} aria-label="Table of contents">
          <p className={styles.tocTitle}>Table of contents</p>
          <ol className={styles.tocList}>
            {tocItems.map(item => (
              <li key={item.id}>
                <a className={styles.tocLink} href={`#${item.id}`}>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className={styles.content}>
          <section id="introduction">
            <h2>Introduction</h2>
            <p>
              This Privacy Policy describes the types of information we collect, how we use it, and
              the choices you have regarding your information. We are committed to transparency
              and to handling your information responsibly.
            </p>
          </section>

          <section id="information-we-collect">
            <h2>1. Information We Collect</h2>
            <h3>1.1 Information You Provide to Us</h3>
            <ul>
              <li>
                <strong>Create an account:</strong> Name, email address, password, and profile
                information
              </li>
              <li>
                <strong>Make a purchase:</strong> Billing information, payment details (processed
                securely through Stripe)
              </li>
              <li>
                <strong>Use our GPT Advisors:</strong> Questions, prompts, and conversation inputs
              </li>
              <li>
                <strong>Participate in our affiliate program:</strong> Payment information, tax
                documentation, referral tracking data
              </li>
              <li>
                <strong>Contact us:</strong> Any information you provide in correspondence or
                support requests
              </li>
              <li>
                <strong>Create or sell products:</strong> Product descriptions, pricing, content
                you upload
              </li>
            </ul>

            <h3>1.2 Information Automatically Collected</h3>
            <ul>
              <li>
                <strong>Device information:</strong> IP address, browser type, operating system,
                device identifiers
              </li>
              <li>
                <strong>Usage data:</strong> Pages visited, time spent, features used, click
                patterns
              </li>
              <li>
                <strong>Cookies and tracking technologies:</strong> Session data, preferences,
                authentication tokens
              </li>
              <li>
                <strong>GPT interaction data:</strong> Conversation history, response patterns,
                personalization preferences
              </li>
            </ul>

            <h3>1.3 Information from Third Parties</h3>
            <ul>
              <li>
                <strong>Stripe Connect:</strong> Payment processing data, transaction history,
                payout information
              </li>
              <li>
                <strong>Google Workspace:</strong> Email delivery metrics and interaction data
              </li>
              <li>
                <strong>Affiliate referrals:</strong> Information about users referred through
                affiliate links
              </li>
            </ul>
          </section>

          <section id="how-we-use">
            <h2>2. How We Use Your Information</h2>
            <h3>2.1 Provide and Improve Services</h3>
            <ul>
              <li>Operate and maintain our platform</li>
              <li>Process transactions and send transaction confirmations</li>
              <li>Provide access to GPT Advisors and digital products</li>
              <li>Personalize your experience based on your interactions and preferences</li>
              <li>Develop new features and improve existing functionality</li>
            </ul>

            <h3>2.2 AI Personalization</h3>
            <p>We store and analyze your GPT Advisor conversations to:</p>
            <ul>
              <li>Provide contextually relevant responses</li>
              <li>Remember your preferences and previous interactions</li>
              <li>Improve the accuracy and helpfulness of AI responses</li>
              <li>Develop better AI models and training data</li>
            </ul>
            <p>
              <strong>Important:</strong> Your GPT conversations are stored in our database and
              used to personalize your experience. We do not sell this data to third parties, but
              we do use it to improve our AI products.
            </p>

            <h3>2.3 Affiliate Program Management</h3>
            <ul>
              <li>Track affiliate relationships and referral chains (up to one level)</li>
              <li>Calculate and process commission payments</li>
              <li>Monitor product sales and performance metrics</li>
              <li>Detect and prevent fraudulent activity</li>
            </ul>

            <h3>2.4 Communications</h3>
            <ul>
              <li>Send account-related notifications and updates</li>
              <li>Deliver customer support responses</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Provide important service announcements</li>
            </ul>

            <h3>2.5 Legal and Security</h3>
            <ul>
              <li>Comply with legal obligations</li>
              <li>Enforce our Terms of Service</li>
              <li>Protect against fraud, abuse, and security threats</li>
              <li>Resolve disputes and investigate complaints</li>
            </ul>
          </section>

          <section id="how-we-share">
            <h2>3. How We Share Your Information</h2>
            <p>
              We do not sell your personal information. We may share your information in the
              following circumstances:
            </p>

            <h3>3.1 Service Providers</h3>
            <ul>
              <li>
                <strong>Stripe:</strong> Payment processing and Stripe Connect merchant services
              </li>
              <li>
                <strong>Supabase:</strong> Database hosting and data storage
              </li>
              <li>
                <strong>Google Workspace:</strong> Email delivery services
              </li>
              <li>
                <strong>Infrastructure providers:</strong> Hosting and technical infrastructure
              </li>
            </ul>
            <p>
              These providers are contractually obligated to protect your information and use it
              only for the purposes we specify.
            </p>

            <h3>3.2 Affiliate Relationships</h3>
            <ul>
              <li>Your referral data is visible to users in your upline (one level only)</li>
              <li>Product performance metrics may be shared with product creators</li>
              <li>Commission data is shared with payment processors</li>
            </ul>

            <h3>3.3 Legal Requirements</h3>
            <ul>
              <li>Comply with legal processes (subpoenas, court orders)</li>
              <li>Enforce our Terms of Service</li>
              <li>Protect our rights, property, or safety</li>
              <li>Investigate fraud or security issues</li>
              <li>Respond to government requests</li>
            </ul>

            <h3>3.4 Business Transfers</h3>
            <p>
              If Quantum Strategies is involved in a merger, acquisition, or sale of assets, your
              information may be transferred. We will notify you of any such change and provide
              choices regarding your information.
            </p>

            <h3>3.5 With Your Consent</h3>
            <p>We may share information for other purposes with your explicit consent.</p>
          </section>

          <section id="data-storage-security">
            <h2>4. Data Storage and Security</h2>
            <h3>4.1 Where We Store Data</h3>
            <ul>
              <li>
                <strong>Supabase databases:</strong> Located in US-East-2
              </li>
              <li>
                <strong>Stripe systems:</strong> Governed by Stripe's security and compliance
                standards
              </li>
              <li>
                <strong>Google Workspace:</strong> Email data stored according to Google's
                infrastructure
              </li>
            </ul>

            <h3>4.2 Security Measures</h3>
            <ul>
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication and password hashing</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and employee training</li>
              <li>Incident response procedures</li>
            </ul>
            <p>
              <strong>However,</strong> no method of transmission over the Internet is 100% secure.
              While we strive to protect your information, we cannot guarantee absolute security.
            </p>

            <h3>4.3 Data Retention</h3>
            <ul>
              <li>Your account is active</li>
              <li>Necessary to provide Services</li>
              <li>Required by law or legitimate business purposes</li>
              <li>You have not requested deletion</li>
            </ul>
            <p>
              <strong>GPT conversation data</strong> is retained indefinitely unless you request
              deletion or delete your account.
            </p>
          </section>

          <section id="privacy-rights">
            <h2>5. Your Privacy Rights</h2>
            <p>Depending on your location, you may have the following rights:</p>

            <h3>5.1 Access and Portability</h3>
            <ul>
              <li>Request a copy of your personal information</li>
              <li>Download your data in a machine-readable format</li>
              <li>Access your GPT conversation history</li>
            </ul>

            <h3>5.2 Correction and Updates</h3>
            <ul>
              <li>Update or correct inaccurate information</li>
              <li>Modify your profile and preferences</li>
            </ul>

            <h3>5.3 Deletion</h3>
            <ul>
              <li>Request deletion of your personal information</li>
              <li>Delete your account and associated data</li>
              <li>Request deletion of specific GPT conversations</li>
            </ul>
            <p>
              <strong>Note:</strong> Some information may be retained for legal, security, or
              legitimate business purposes even after deletion requests.
            </p>

            <h3>5.4 Objection and Restriction</h3>
            <ul>
              <li>Object to certain data processing activities</li>
              <li>Restrict how we use your information</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h3>5.5 Withdraw Consent</h3>
            <ul>
              <li>Withdraw consent for data processing where consent is the legal basis</li>
              <li>Disable personalization features</li>
            </ul>

            <h3>5.6 User Portrait Controls</h3>
            <p>
              If you use products that generate briefings, you can view your full User Portrait,
              reset any section of it, review the audit log of how it has been used, or opt out of
              Portrait building entirely at <strong>/profile/portrait</strong>. See section 13 for
              how this system works and how to request deletion of existing Portrait data.
            </p>

            <h3>5.7 How to Exercise Your Rights</h3>
            <p>To exercise any of these rights, contact us at:</p>
            <p>
              <strong>Email:</strong> austin@xuberandigital.com
              <br />
              <strong>Address:</strong> (Available upon request for legal notices)
            </p>
            <p>
              We will respond to requests within 30 days and may require identity verification.
            </p>
          </section>

          <section id="international-transfers">
            <h2>6. International Data Transfers</h2>
            <p>
              Quantum Strategies is based in the United States. If you access our Services from
              outside the US, your information will be transferred to, stored, and processed in the
              United States.
            </p>
            <p>
              The United States may not have the same data protection laws as your jurisdiction. By
              using our Services, you consent to the transfer of your information to the United
              States and processing as described in this Privacy Policy.
            </p>
            <p>For users in the European Economic Area (EEA) or United Kingdom, we rely on:</p>
            <ul>
              <li>Standard Contractual Clauses approved by the European Commission</li>
              <li>Your explicit consent for data transfers</li>
              <li>Necessary transfers for contract performance</li>
            </ul>
          </section>

          <section id="children">
            <h2>7. Children's Privacy</h2>
            <p>
              Our Services are not intended for individuals under 18 years of age. We do not
              knowingly collect personal information from children. If you believe we have
              collected information from a child, please contact us immediately, and we will
              delete such information.
            </p>
          </section>

          <section id="cookies">
            <h2>8. Cookies and Tracking Technologies</h2>
            <h3>8.1 What We Use</h3>
            <ul>
              <li>
                <strong>Essential cookies:</strong> Required for basic site functionality and
                authentication
              </li>
              <li>
                <strong>Analytics cookies:</strong> Track usage patterns and performance metrics
              </li>
              <li>
                <strong>Preference cookies:</strong> Remember your settings and customization
              </li>
              <li>
                <strong>Session cookies:</strong> Maintain your login state and session data
              </li>
            </ul>

            <h3>8.2 Your Cookie Choices</h3>
            <ul>
              <li>Browser settings (block or delete cookies)</li>
              <li>Our cookie consent banner (opt out of non-essential cookies)</li>
              <li>Third-party opt-out tools</li>
            </ul>
            <p>
              <strong>Note:</strong> Disabling essential cookies may impair site functionality.
            </p>
          </section>

          <section id="third-party-links">
            <h2>9. Third-Party Links</h2>
            <p>
              Our Services may contain links to third-party websites or services. We are not
              responsible for the privacy practices of these third parties. We encourage you to
              read their privacy policies before providing any information.
            </p>
          </section>

          <section id="ccpa">
            <h2>10. California Privacy Rights (CCPA)</h2>
            <p>If you are a California resident, you have additional rights under the CCPA:</p>

            <h3>10.1 Right to Know</h3>
            <ul>
              <li>Categories of personal information collected</li>
              <li>Sources of personal information</li>
              <li>Business purposes for collection</li>
              <li>Categories of third parties with whom we share information</li>
              <li>Specific pieces of personal information we hold</li>
            </ul>

            <h3>10.2 Right to Delete</h3>
            <p>Request deletion of your personal information, subject to certain exceptions.</p>

            <h3>10.3 Right to Opt-Out</h3>
            <p>
              We do not sell personal information. If our practices change, we will update this
              policy and provide opt-out mechanisms.
            </p>

            <h3>10.4 Non-Discrimination</h3>
            <p>We will not discriminate against you for exercising your CCPA rights.</p>

            <h3>10.5 Authorized Agents</h3>
            <p>You may designate an authorized agent to make requests on your behalf.</p>
          </section>

          <section id="gdpr">
            <h2>11. European Privacy Rights (GDPR)</h2>
            <p>
              If you are in the European Economic Area or United Kingdom, you have rights under
              the General Data Protection Regulation:
            </p>

            <h3>11.1 Legal Basis for Processing</h3>
            <ul>
              <li>
                <strong>Contract performance:</strong> To provide Services you've requested
              </li>
              <li>
                <strong>Legitimate interests:</strong> To improve Services and prevent fraud
              </li>
              <li>
                <strong>Consent:</strong> For marketing communications and AI personalization
              </li>
              <li>
                <strong>Legal obligations:</strong> To comply with applicable laws
              </li>
            </ul>

            <h3>11.2 Data Protection Officer</h3>
            <p>
              For GDPR-related inquiries, contact our Data Protection Officer at:
              <br />
              <strong>Email:</strong> austin@xuberandigital.com
            </p>

            <h3>11.3 Supervisory Authority</h3>
            <p>You have the right to lodge a complaint with your local data protection authority.</p>
          </section>

          <section id="ai">
            <h2>12. AI and Automated Decision-Making</h2>
            <p>We use AI (GPT Advisors) to provide personalized recommendations and responses.</p>
            <ul>
              <li>Analyze your conversation history and preferences</li>
              <li>Make automated suggestions based on patterns</li>
              <li>Personalize content and product recommendations</li>
            </ul>
            <p>You have the right to:</p>
            <ul>
              <li>Understand how AI decisions are made</li>
              <li>Object to automated decision-making</li>
              <li>Request human review of AI-generated content</li>
            </ul>
            <p>
              <strong>Important:</strong> Our GPT Advisors are tools for guidance and exploration.
              They do not make legally binding decisions, and you should not rely solely on AI
              outputs for critical decisions.
            </p>
          </section>

          <section id="briefings-portrait">
            <h2>13. Personalized Briefings and the User Portrait</h2>
            <p>
              Each product session ends with a written briefing — a markdown document that
              summarizes what came up for you and what to do with it. We store these briefings in
              our database so you can return to them later and so future products can build on what
              you've already worked through, rather than starting from zero each time.
            </p>
            <p>
              To make that continuity possible, we also maintain a structured summary of what you
              have told us across products, which we call your User Portrait. The Portrait organizes
              what we have learned into sections such as identity, values, energy patterns,
              activity, results, and path. Each section records a current state, prior states for
              comparison, and any transitions we have detected. Every entry is tied to evidence
              from your own responses or briefings — we do not store claims about you without a
              source.
            </p>
            <p>
              The Portrait is built by a small, narrowly-scoped AI extraction step that runs after
              a briefing is generated. We send the briefing text and your responses from that
              session to OpenAI's API (using the <em>gpt-4o-mini</em> model) to extract structured
              updates, then write those updates back to your Portrait in our database. This is the
              same usage pattern described in our AI and Automated Decision-Making section: data
              is sent to OpenAI for inference only, and we do not opt in to OpenAI using your data
              to train their models.
            </p>
            <p>
              When a new product generates a briefing for you, the system reads your Portrait and
              any linked past briefings and prepends that context to the prompt sent to the AI.
              This is what allows briefings to reference what you've previously surfaced instead of
              treating each session as isolated. We keep an internal audit log of which briefing
              read which Portrait fields and which extraction wrote which fields, so the history of
              how your Portrait has been used is reviewable.
            </p>
            <h3>13.1 Your Controls</h3>
            <p>
              You can view your full Portrait at any time at <strong>/profile/portrait</strong>,
              along with the audit log showing how it has been used. From that page you can reset
              any section or specific field, and you can opt out of Portrait building entirely with
              a single toggle. When opted out, your briefings are still generated and stored so you
              can reread them, but no extraction runs and no cross-product context is injected into
              future prompts. Existing Portrait data is retained but no longer read or updated; to
              delete it, contact us at the email below.
            </p>
            <h3>13.2 Retention</h3>
            <p>
              Briefings and your Portrait are retained for the lifetime of your account and are
              deleted when you delete your account. The internal audit log of Portrait reads and
              writes is retained for 24 months from creation.
            </p>
            <h3>13.3 Where This Data Lives</h3>
            <p>
              Briefings, Portrait data, and audit logs are stored in our Supabase database in the
              United States, alongside the rest of your account data. The only external service
              that sees this content is OpenAI, and only at the moment of extraction or generation
              as described above.
            </p>
          </section>

          <section id="changes">
            <h2>14. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy periodically to reflect:</p>
            <ul>
              <li>Changes in our Services or practices</li>
              <li>Legal or regulatory requirements</li>
              <li>Feedback from users</li>
            </ul>
            <p>We will notify you of material changes by:</p>
            <ul>
              <li>Posting the updated policy on our website</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending email notifications for significant changes (if you have an account)</li>
            </ul>
            <p>
              Your continued use of our Services after changes constitutes acceptance of the
              updated Privacy Policy.
            </p>
          </section>

          <section id="contact">
            <h2>15. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our
              privacy practices, please contact us:
            </p>
            <p>
              <strong>Email:</strong> austin@xuberandigital.com
              <br />
              <strong>Address:</strong> (Available upon request for legal notices)
              <br />
              <strong>Business Entity:</strong> Xuberan Digital LLC
            </p>
          </section>

          <section id="affiliate-privacy">
            <h2>16. Affiliate Program Specific Privacy</h2>
            <h3>15.1 Affiliate Data Collection</h3>
            <ul>
              <li>Referral link tracking data</li>
              <li>Commission calculations and payment history</li>
              <li>Performance metrics (clicks, conversions, sales)</li>
              <li>One level of downline activity (users you refer who become affiliates)</li>
            </ul>

            <h3>15.2 Transparency</h3>
            <ul>
              <li>Your own affiliate performance data</li>
              <li>Commission earnings and payment history</li>
              <li>General statistics about your referred users</li>
            </ul>
            <p>You cannot view:</p>
            <ul>
              <li>Personal information of users you refer</li>
              <li>Detailed activity of downline affiliates beyond aggregate metrics</li>
            </ul>

            <h3>15.3 Tax Reporting</h3>
            <p>
              We may share your affiliate earnings information with tax authorities as required by
              law (e.g., IRS Form 1099 reporting for US affiliates earning over $600).
            </p>

            <p>
              <strong>By using Quantum Strategies, you acknowledge that you have read and
              understood this Privacy Policy.</strong>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
