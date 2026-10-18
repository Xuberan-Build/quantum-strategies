import type { Metadata } from "next";
import styles from "@/styles/pages/LegalPage.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern use of the Quantum Strategies website, products and services.",
  alternates: { canonical: "https://quantumstrategies.online/terms/" },
};

const tocItems = [
  { id: "agreement", label: "Agreement to Terms" },
  { id: "definitions", label: "Definitions" },
  { id: "eligibility", label: "Eligibility" },
  { id: "account", label: "Account Registration and Security" },
  { id: "use", label: "Use of Services" },
  { id: "ai-services", label: "GPT Advisors and AI Services" },
  { id: "digital-products", label: "Digital Products and Purchases" },
  { id: "creators", label: "Creating and Selling Products" },
  { id: "affiliate", label: "Affiliate Program" },
  { id: "ip", label: "Intellectual Property" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "disclaimers", label: "Disclaimers and Limitations of Liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "dispute", label: "Dispute Resolution" },
  { id: "governing-law", label: "Governing Law and Venue" },
  { id: "general", label: "General Provisions" },
  { id: "changes", label: "Changes to Terms" },
  { id: "contact", label: "Contact Information" },
  { id: "affiliate-disclosure", label: "Affiliate Income Disclosure (FTC)" },
];

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <h1>Terms of Service</h1>
          <div className={styles.meta}>
            <span>Effective Date: [INSERT DATE]</span>
            <span>Last Updated: [INSERT DATE]</span>
          </div>
          <p>
            Welcome to Quantum Strategies. These Terms of Service ("Terms") govern your access to
            and use of our website, services, AI-powered products, and affiliate program
            (collectively, the "Services").
          </p>
          <p>
            <strong>By accessing or using our Services, you agree to be bound by these Terms.</strong>{" "}
            If you do not agree to these Terms, you may not access or use our Services.
          </p>
          <p>
            We reserve the right to modify these Terms at any time. Continued use of our Services
            after changes constitutes acceptance of the modified Terms.
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
          <section id="agreement">
            <h2>Agreement to Terms</h2>
            <p>
              These Terms govern your access to and use of our Services. By accessing or using our
              Services, you agree to be bound by these Terms. If you do not agree, you may not
              access or use the Services.
            </p>
          </section>

          <section id="definitions">
            <h2>1. Definitions</h2>
            <ul>
              <li>
                <strong>"We," "Us," "Our," "Company"</strong> refers to Quantum Strategies, operated
                by [INSERT S-CORP NAME]
              </li>
              <li>
                <strong>"You," "Your," "User"</strong> refers to any person or entity accessing our
                Services
              </li>
              <li>
                <strong>"Account"</strong> refers to your registered user account
              </li>
              <li>
                <strong>"Content"</strong> refers to all information, data, text, software,
                graphics, or materials
              </li>
              <li>
                <strong>"GPT Advisors"</strong> refers to our AI-powered conversational tools and
                products
              </li>
              <li>
                <strong>"Digital Products"</strong> refers to purchasable content, tools, or
                resources available on our platform
              </li>
              <li>
                <strong>"Affiliate"</strong> refers to users participating in our commission-based
                referral program
              </li>
            </ul>
          </section>

          <section id="eligibility">
            <h2>2. Eligibility</h2>
            <p>To use our Services, you must:</p>
            <ul>
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Not be prohibited from using our Services under applicable law</li>
              <li>Provide accurate and complete registration information</li>
              <li>Comply with all Terms and applicable laws</li>
            </ul>
            <p>
              <strong>Minors:</strong> Our Services are not intended for individuals under 18. If
              you are under 18, you may not use our Services.
            </p>
          </section>

          <section id="account">
            <h2>3. Account Registration and Security</h2>
            <h3>3.1 Account Creation</h3>
            <p>To access certain features, you must create an account by providing:</p>
            <ul>
              <li>Valid email address</li>
              <li>Secure password</li>
              <li>Accurate personal and payment information (if making purchases)</li>
            </ul>

            <h3>3.2 Account Responsibilities</h3>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of unauthorized access or security breaches</li>
              <li>Ensuring your account information remains accurate and current</li>
            </ul>

            <h3>3.3 Account Termination</h3>
            <p>We reserve the right to suspend or terminate your account if you:</p>
            <ul>
              <li>Violate these Terms</li>
              <li>Engage in fraudulent or illegal activities</li>
              <li>Abuse our Services or other users</li>
              <li>Fail to pay for purchased Services</li>
              <li>Provide false or misleading information</li>
            </ul>
            <p>
              You may terminate your account at any time by contacting us or using account deletion
              features. Termination does not relieve you of obligations incurred prior to
              termination.
            </p>
          </section>

          <section id="use">
            <h2>4. Use of Services</h2>
            <h3>4.1 Permitted Uses</h3>
            <p>You may use our Services to:</p>
            <ul>
              <li>Access and use GPT Advisors for personal guidance and exploration</li>
              <li>Purchase and access digital products</li>
              <li>Create and sell digital products (subject to approval)</li>
              <li>Participate in our affiliate program</li>
              <li>Interact with our community features</li>
            </ul>

            <h3>4.2 Prohibited Uses</h3>
            <p>You may NOT:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit malware, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Impersonate any person or entity</li>
              <li>Scrape, mine, or extract data without permission</li>
              <li>Use our Services for illegal, fraudulent, or deceptive purposes</li>
              <li>Manipulate affiliate tracking or referral systems</li>
              <li>Create fake accounts or engage in artificial transaction activity</li>
              <li>Share account credentials with others</li>
              <li>Reverse engineer or decompile our software</li>
              <li>Use GPT Advisors to generate harmful, illegal, or misleading content</li>
              <li>Resell access to our GPT Advisors without authorization</li>
            </ul>

            <h3>4.3 Enforcement</h3>
            <p>We reserve the right to investigate violations and take appropriate action, including:</p>
            <ul>
              <li>Removing or disabling Content</li>
              <li>Suspending or terminating accounts</li>
              <li>Withholding affiliate commissions</li>
              <li>Reporting illegal activity to authorities</li>
              <li>Pursuing legal remedies</li>
            </ul>
          </section>

          <section id="ai-services">
            <h2>5. GPT Advisors and AI Services</h2>
            <h3>5.1 Nature of AI Services</h3>
            <p>Our GPT Advisors are AI-powered tools designed to provide:</p>
            <ul>
              <li>Personalized guidance and insights</li>
              <li>Creative exploration and brainstorming</li>
              <li>Educational content and explanations</li>
              <li>Strategic frameworks and methodologies</li>
            </ul>
            <p>
              <strong>Important Disclaimers:</strong>
            </p>
            <ul>
              <li>GPT Advisors are tools, not substitutes for professional advice</li>
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>Do not rely solely on AI outputs for critical decisions</li>
              <li>GPT responses are based on patterns, not human judgment</li>
              <li>We do not guarantee the accuracy, completeness, or reliability of AI outputs</li>
            </ul>

            <h3>5.2 Personalization and Data Usage</h3>
            <p>By using GPT Advisors, you understand and agree that:</p>
            <ul>
              <li>Your conversations are stored and analyzed</li>
              <li>We use your interaction data to personalize responses</li>
              <li>Historical conversations inform future interactions</li>
              <li>We may use anonymized data to improve AI models</li>
            </ul>
            <p>
              You can request deletion of your conversation history as described in our Privacy
              Policy.
            </p>

            <h3>5.3 Appropriate Use of AI</h3>
            <p>You agree to use GPT Advisors responsibly and NOT for:</p>
            <ul>
              <li>Generating illegal content or instructions</li>
              <li>Creating misleading or fraudulent materials</li>
              <li>Harassing or threatening others</li>
              <li>Producing copyrighted content without authorization</li>
              <li>Exploiting vulnerabilities in AI systems</li>
              <li>Automated or bulk querying without permission</li>
            </ul>

            <h3>5.4 No Professional Advice</h3>
            <p>GPT Advisors do not provide:</p>
            <ul>
              <li>Legal advice (we are not attorneys)</li>
              <li>Medical advice (we are not healthcare providers)</li>
              <li>Financial advice (we are not financial advisors)</li>
              <li>Professional counseling or therapy</li>
            </ul>
            <p>Always consult qualified professionals for specialized advice.</p>
          </section>

          <section id="digital-products">
            <h2>6. Digital Products and Purchases</h2>
            <h3>6.1 Product Descriptions</h3>
            <p>We strive to accurately describe all digital products. However:</p>
            <ul>
              <li>Descriptions may contain errors or omissions</li>
              <li>We reserve the right to correct inaccuracies</li>
              <li>Product features and availability may change</li>
              <li>Visual representations may differ from actual products</li>
            </ul>

            <h3>6.2 Pricing and Payment</h3>
            <ul>
              <li>All prices are in US Dollars (USD) unless otherwise stated</li>
              <li>Prices are subject to change without notice</li>
              <li>You agree to pay all applicable fees and charges</li>
              <li>Payment processing is handled securely through Stripe</li>
              <li>You authorize us to charge your designated payment method</li>
            </ul>

            <h3>6.3 Refund Policy</h3>
            <p>
              <strong>Digital products are generally non-refundable</strong> due to their nature.
              However, we may offer refunds at our sole discretion in cases of:
            </p>
            <ul>
              <li>Technical issues preventing access</li>
              <li>Significant product defects or errors</li>
              <li>Billing errors or unauthorized charges</li>
            </ul>
            <p>
              Refund requests must be submitted within [INSERT TIMEFRAME - e.g., 7 days] of purchase
              to austin@xuberandigital.com.
            </p>

            <h3>6.4 Access and Delivery</h3>
            <ul>
              <li>Digital products are delivered electronically</li>
              <li>Access is granted upon successful payment confirmation</li>
              <li>You are responsible for downloading and storing products</li>
              <li>We are not liable for loss of access due to account termination or technical issues</li>
            </ul>

            <h3>6.5 License to Use Products</h3>
            <p>
              When you purchase a digital product, you receive a limited, non-exclusive,
              non-transferable license to:
            </p>
            <ul>
              <li>Access and use the product for personal or commercial purposes (as specified)</li>
              <li>Download and store copies for personal backup</li>
            </ul>
            <p>You may NOT:</p>
            <ul>
              <li>Redistribute, resell, or share products without authorization</li>
              <li>Claim ownership or authorship of products</li>
              <li>Modify products without permission (unless explicitly allowed)</li>
              <li>Use products to create competing products</li>
            </ul>
          </section>

          <section id="creators">
            <h2>7. Creating and Selling Products</h2>
            <h3>7.1 Product Creator Terms</h3>
            <p>If you create and sell products on our platform, you agree that:</p>
            <ul>
              <li>You own or have rights to all content in your products</li>
              <li>Products comply with all applicable laws and our policies</li>
              <li>Products do not infringe on third-party intellectual property</li>
              <li>Product descriptions are accurate and not misleading</li>
              <li>You are responsible for product quality and customer satisfaction</li>
            </ul>

            <h3>7.2 Revenue Sharing</h3>
            <p>We operate on a revenue-sharing model where:</p>
            <ul>
              <li>You set the price for your products</li>
              <li>We retain [INSERT PLATFORM FEE %] of each sale as a platform fee</li>
              <li>You receive [INSERT CREATOR %] of each sale</li>
              <li>Payments are processed through Stripe Connect</li>
              <li>Commissions are calculated net of refunds and chargebacks</li>
            </ul>

            <h3>7.3 Product Approval</h3>
            <p>We reserve the right to:</p>
            <ul>
              <li>Review and approve products before listing</li>
              <li>Remove products that violate our policies</li>
              <li>Suspend creator accounts for violations</li>
              <li>Withhold payments for fraudulent or disputed transactions</li>
            </ul>

            <h3>7.4 Creator Obligations</h3>
            <p>As a product creator, you must:</p>
            <ul>
              <li>Provide customer support for your products</li>
              <li>Honor refund requests as applicable</li>
              <li>Maintain product quality and accuracy</li>
              <li>Update products to fix errors or issues</li>
              <li>Comply with tax reporting requirements</li>
            </ul>
          </section>

          <section id="affiliate">
            <h2>8. Affiliate Program</h2>
            <h3>8.1 Program Overview</h3>
            <p>Our affiliate program allows you to earn commissions by:</p>
            <ul>
              <li>Referring users who purchase products (direct referrals)</li>
              <li>Earning on sales made by affiliates you refer (one level downline)</li>
            </ul>
            <p>
              <strong>This is NOT a pyramid scheme or multi-level marketing (MLM) scheme.</strong>{" "}
              Commissions are earned ONLY from actual product sales, not from recruiting affiliates.
            </p>

            <h3>8.2 Affiliate Eligibility</h3>
            <p>To participate as an affiliate, you must:</p>
            <ul>
              <li>Have an active account in good standing</li>
              <li>Agree to ethical marketing practices</li>
              <li>Comply with FTC guidelines on disclosures</li>
              <li>Provide accurate tax information</li>
              <li>Not engage in fraudulent referral activities</li>
            </ul>

            <h3>8.3 Commission Structure</h3>
            <p>
              <strong>Direct Referrals:</strong> [INSERT %] of sales from users you directly refer
              <br />
              <strong>Downline Sales:</strong> [INSERT %] of sales from affiliates you refer (one
              level only)
            </p>
            <p>Commissions are:</p>
            <ul>
              <li>Calculated on net sales (after refunds and chargebacks)</li>
              <li>Paid monthly via Stripe Connect</li>
              <li>Subject to minimum payout thresholds of [INSERT AMOUNT]</li>
              <li>Reported for tax purposes (1099 for US affiliates earning $600+)</li>
            </ul>

            <h3>8.4 Affiliate Responsibilities</h3>
            <p>You agree to:</p>
            <ul>
              <li>Use only approved marketing materials and methods</li>
              <li>Disclose your affiliate relationship when promoting products</li>
              <li>Not make false or misleading claims about products</li>
              <li>Not engage in spam, deceptive advertising, or trademark bidding</li>
              <li>Not create fake accounts or artificial referrals</li>
              <li>Comply with FTC endorsement guidelines and all applicable laws</li>
            </ul>

            <h3>8.5 Prohibited Affiliate Practices</h3>
            <p>You may NOT:</p>
            <ul>
              <li>Guarantee income or results from products</li>
              <li>Make unsubstantiated health, financial, or success claims</li>
              <li>Use our brand name in domain names or paid search without permission</li>
              <li>Generate self-referrals or circular commission schemes</li>
              <li>Cookie-stuff, use pop-ups/pop-unders, or employ deceptive tactics</li>
              <li>Promote products in a manner that violates our values or brand</li>
            </ul>

            <h3>8.6 Commission Withholding and Clawbacks</h3>
            <p>We reserve the right to:</p>
            <ul>
              <li>Withhold commissions for suspected fraud or violations</li>
              <li>Reverse commissions for refunded or disputed transactions</li>
              <li>Claw back previously paid commissions if fraud is discovered</li>
              <li>Terminate affiliate status for policy violations</li>
            </ul>

            <h3>8.7 FTC Disclosure Requirements</h3>
            <p>
              <strong>REQUIRED DISCLOSURE:</strong> Most affiliate marketers earn little to no
              income. The average affiliate in our program earns [INSERT REALISTIC FIGURE OR STATE
              "less than $X per month"]. Your results may vary significantly based on effort,
              audience, and market conditions.
            </p>
            <p>As an affiliate, you MUST:</p>
            <ul>
              <li>Clearly disclose your affiliate relationship when promoting products</li>
              <li>Use phrases like "I may earn a commission if you purchase through my link"</li>
              <li>Not make income claims unless you have substantiation</li>
              <li>Follow FTC guidelines on endorsements and testimonials</li>
            </ul>
          </section>

          <section id="ip">
            <h2>9. Intellectual Property</h2>
            <h3>9.1 Our Intellectual Property</h3>
            <p>
              All content, features, and functionality of our Services, including but not limited
              to:
            </p>
            <ul>
              <li>GPT Advisor technology and algorithms</li>
              <li>Platform design, code, and architecture</li>
              <li>Trademarks, logos, and branding</li>
              <li>Original digital products we create</li>
              <li>Documentation and marketing materials</li>
            </ul>
            <p>
              ...are owned by Quantum Strategies or our licensors and are protected by copyright,
              trademark, and other intellectual property laws.
            </p>

            <h3>9.2 Limited License to Use</h3>
            <p>
              We grant you a limited, non-exclusive, non-transferable license to access and use our
              Services for their intended purposes. This license does not permit you to:
            </p>
            <ul>
              <li>Copy, modify, or create derivative works</li>
              <li>Distribute, sell, or sublicense our Services</li>
              <li>Reverse engineer or attempt to extract source code</li>
              <li>Remove proprietary notices or labels</li>
              <li>Use our intellectual property for commercial purposes without permission</li>
            </ul>

            <h3>9.3 User Content Ownership</h3>
            <p>
              You retain ownership of content you create and upload ("User Content"). However, by
              submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license
              to:
            </p>
            <ul>
              <li>Host, store, and display your content</li>
              <li>Use your content to provide and improve Services</li>
              <li>Create derivative works for operational purposes</li>
              <li>Sublicense to service providers (e.g., hosting, CDN)</li>
            </ul>
            <p>
              This license continues even after you delete content or terminate your account, to
              the extent necessary for ongoing operations.
            </p>

            <h3>9.4 Feedback and Suggestions</h3>
            <p>If you provide feedback, suggestions, or ideas about our Services:</p>
            <ul>
              <li>You grant us the right to use, modify, and implement them without compensation</li>
              <li>We are not obligated to implement any feedback</li>
              <li>Feedback becomes our property and is not confidential</li>
            </ul>

            <h3>9.5 Copyright Infringement</h3>
            <p>
              We respect intellectual property rights. If you believe content on our platform
              infringes your copyright, please contact us with:
            </p>
            <ul>
              <li>Description of the copyrighted work</li>
              <li>Location of the infringing material (URL)</li>
              <li>Your contact information</li>
              <li>Statement of good faith belief that use is unauthorized</li>
              <li>Statement that information is accurate and you are authorized to act</li>
            </ul>
            <p>
              <strong>DMCA Notices:</strong> austin@xuberandigital.com
            </p>
            <p>
              We will investigate claims and remove infringing content as appropriate. Repeat
              infringers may have their accounts terminated.
            </p>
          </section>

          <section id="third-party">
            <h2>10. Third-Party Services</h2>
            <h3>10.1 Stripe Payment Processing</h3>
            <p>
              Payment processing is handled by Stripe. By making purchases or receiving payouts,
              you agree to:
            </p>
            <ul>
              <li>Stripe's Terms of Service</li>
              <li>Stripe Connect Terms (for product creators and affiliates)</li>
              <li>Stripe's privacy practices</li>
            </ul>
            <p>We are not responsible for Stripe's services, security, or policies.</p>

            <h3>10.2 External Links</h3>
            <p>
              Our Services may contain links to third-party websites or services. We do not control
              or endorse these third parties and are not responsible for:
            </p>
            <ul>
              <li>Their content, products, or services</li>
              <li>Their privacy practices or terms</li>
              <li>Any damages or losses from your use of third-party services</li>
            </ul>

            <h3>10.3 Integrations</h3>
            <p>
              We may integrate with third-party tools and services. Your use of these integrations
              is subject to their respective terms and policies.
            </p>
          </section>

          <section id="disclaimers">
            <h2>11. Disclaimers and Limitations of Liability</h2>
            <h3>11.1 No Warranties</h3>
            <p>
              OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul>
              <li>Warranties of merchantability or fitness for a particular purpose</li>
              <li>Warranties of accuracy, reliability, or completeness</li>
              <li>Warranties that Services will be uninterrupted or error-free</li>
              <li>Warranties regarding GPT Advisor outputs or AI accuracy</li>
            </ul>

            <h3>11.2 Use at Your Own Risk</h3>
            <p>YOU ACKNOWLEDGE AND AGREE THAT:</p>
            <ul>
              <li>You use our Services at your own risk</li>
              <li>We do not guarantee specific results or outcomes</li>
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>Digital products may not meet your specific needs</li>
              <li>Affiliate earnings are not guaranteed and may be zero</li>
            </ul>

            <h3>11.3 Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUANTUM STRATEGIES AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR:
            </p>
            <ul>
              <li>Indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Damages arising from use or inability to use Services</li>
              <li>Damages from third-party content or services</li>
              <li>Damages from unauthorized access to your account or data</li>
            </ul>
            <p>
              OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THESE TERMS OR
              OUR SERVICES SHALL NOT EXCEED THE GREATER OF:
            </p>
            <ul>
              <li>The amount you paid us in the 12 months preceding the claim, OR</li>
              <li>$100 USD</li>
            </ul>

            <h3>11.4 Basis of the Bargain</h3>
            <p>
              These disclaimers and limitations are fundamental elements of our agreement. We would
              not provide Services without these protections.
            </p>

            <h3>11.5 Jurisdictional Variations</h3>
            <p>
              Some jurisdictions do not allow certain warranty exclusions or liability limitations.
              In such cases, our liability is limited to the maximum extent permitted by law.
            </p>
          </section>

          <section id="indemnification">
            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Quantum Strategies and its officers,
              directors, employees, contractors, and affiliates from and against any claims,
              liabilities, damages, losses, and expenses (including reasonable attorneys' fees)
              arising from or related to:
            </p>
            <ul>
              <li>Your use or misuse of our Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of third parties</li>
              <li>User Content you submit or create</li>
              <li>Products you create and sell on our platform</li>
              <li>Your affiliate marketing activities</li>
              <li>Any fraudulent or illegal activities</li>
            </ul>
            <p>
              We reserve the right to assume exclusive defense and control of any matter subject to
              indemnification, and you agree to cooperate with our defense.
            </p>
          </section>

          <section id="dispute">
            <h2>13. Dispute Resolution</h2>
            <h3>13.1 Informal Resolution</h3>
            <p>
              Before filing any formal dispute, you agree to contact us at
              austin@xuberandigital.com to attempt informal resolution. We will work in good faith
              to resolve disputes within 30 days.
            </p>

            <h3>13.2 Binding Arbitration</h3>
            <p>
              If informal resolution fails, any dispute arising from or relating to these Terms or
              our Services shall be resolved through binding arbitration administered by the
              American Arbitration Association (AAA) under its Commercial Arbitration Rules.
            </p>
            <p>
              <strong>Arbitration Terms:</strong>
            </p>
            <ul>
              <li>Arbitration shall be conducted by a single neutral arbitrator</li>
              <li>Location: [INSERT LOCATION - typically your state/county]</li>
              <li>Governing law: Laws of [INSERT STATE], excluding conflict of law provisions</li>
              <li>Each party bears their own costs and attorneys' fees unless the arbitrator awards otherwise</li>
              <li>The arbitrator's decision is final and binding</li>
              <li>Judgment on the award may be entered in any court of competent jurisdiction</li>
            </ul>

            <h3>13.3 Class Action Waiver</h3>
            <p>
              YOU AGREE TO BRING CLAIMS ONLY IN YOUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR
              CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING.
            </p>

            <h3>13.4 Exceptions to Arbitration</h3>
            <p>Either party may seek injunctive or equitable relief in court to:</p>
            <ul>
              <li>Prevent actual or threatened infringement of intellectual property</li>
              <li>Enforce confidentiality obligations</li>
              <li>Address urgent security or safety concerns</li>
            </ul>

            <h3>13.5 Small Claims Court</h3>
            <p>Either party may bring a claim in small claims court if it qualifies and remains in that court.</p>

            <h3>13.6 30-Day Right to Opt Out</h3>
            <p>
              You may opt out of arbitration by sending written notice within 30 days of first
              accepting these Terms to austin@xuberandigital.com. Your notice must include your
              name, address, and clear statement that you wish to opt out of arbitration.
            </p>
          </section>

          <section id="governing-law">
            <h2>14. Governing Law and Venue</h2>
            <p>
              These Terms are governed by the laws of the State of [INSERT STATE], United States,
              without regard to conflict of law principles.
            </p>
            <p>
              For any disputes not subject to arbitration, you agree to exclusive jurisdiction and
              venue in the state and federal courts located in [INSERT COUNTY AND STATE].
            </p>
          </section>

          <section id="general">
            <h2>15. General Provisions</h2>
            <h3>15.1 Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy and any additional terms specific to
              certain Services, constitute the entire agreement between you and Quantum Strategies
              regarding our Services.
            </p>

            <h3>15.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the
              remaining provisions shall remain in full force and effect. Invalid provisions will
              be modified to the minimum extent necessary to make them valid and enforceable.
            </p>

            <h3>15.3 Waiver</h3>
            <p>
              Our failure to enforce any provision of these Terms does not constitute a waiver of
              that provision or our right to enforce it in the future.
            </p>

            <h3>15.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms or your account without our written
              consent. We may assign these Terms to any affiliate, successor, or acquirer without
              restriction.
            </p>

            <h3>15.5 Force Majeure</h3>
            <p>We are not liable for failures or delays caused by circumstances beyond our reasonable control, including:</p>
            <ul>
              <li>Natural disasters or acts of God</li>
              <li>War, terrorism, or civil unrest</li>
              <li>Government actions or regulations</li>
              <li>Internet or utility failures</li>
              <li>Pandemics or public health emergencies</li>
            </ul>

            <h3>15.6 Survival</h3>
            <p>Provisions that by their nature should survive termination shall survive, including but not limited to:</p>
            <ul>
              <li>Intellectual property rights</li>
              <li>Disclaimers and limitations of liability</li>
              <li>Indemnification obligations</li>
              <li>Dispute resolution provisions</li>
            </ul>

            <h3>15.7 Notices</h3>
            <p>We may provide notices to you:</p>
            <ul>
              <li>By email to your registered email address</li>
              <li>By posting on our website or within our Services</li>
              <li>Through your account dashboard</li>
            </ul>
            <p>Notices are effective upon sending or posting.</p>
            <p>
              You may provide notices to us at:
              <br />
              <strong>Email:</strong> austin@xuberandigital.com
              <br />
              <strong>Address:</strong> (Available upon request for legal notices)
            </p>

            <h3>15.8 Relationship</h3>
            <p>
              These Terms do not create any partnership, joint venture, employment, or agency
              relationship. You may not make commitments or statements on our behalf.
            </p>

            <h3>15.9 Third-Party Beneficiaries</h3>
            <p>
              These Terms do not confer any rights or remedies on any third party except as
              expressly provided.
            </p>

            <h3>15.10 Headings</h3>
            <p>Section headings are for convenience only and do not affect interpretation.</p>
          </section>

          <section id="changes">
            <h2>16. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. When we make material changes:</p>
            <ul>
              <li>We will update the "Last Updated" date</li>
              <li>We will notify you via email or prominent notice on our website</li>
              <li>Your continued use of Services after changes constitutes acceptance</li>
            </ul>
            <p>
              If you do not agree to modified Terms, you must stop using our Services and may
              terminate your account.
            </p>
          </section>

          <section id="contact">
            <h2>17. Contact Information</h2>
            <p>For questions, concerns, or notices regarding these Terms, contact us:</p>
            <p>
              <strong>Email:</strong> austin@xuberandigital.com
              <br />
              <strong>Address:</strong> (Available upon request for legal notices)
              <br />
              <strong>Business Entity:</strong> Xuberan Digital LLC
              <br />
              <strong>Support:</strong> austin@xuberandigital.com
            </p>
          </section>

          <section id="affiliate-disclosure">
            <h2>18. Affiliate Income Disclosure (FTC Compliance)</h2>
            <p>
              <strong>IMPORTANT NOTICE FOR AFFILIATES:</strong>
            </p>
            <ol>
              <li>
                <strong>Typical Earnings:</strong> The majority of affiliates in our program earn
                little to no income. [INSERT SPECIFIC STATISTICS if available, e.g., "The average
                affiliate earns less than $50 per month" or "75% of affiliates earn less than $100
                in their first year"]
              </li>
              <li>
                <strong>No Income Guarantees:</strong> We make no guarantees about your ability to
                earn money through our affiliate program. Your results depend on many factors
                including your effort, audience, marketing skills, and market conditions.
              </li>
              <li>
                <strong>Required Investment:</strong> While joining our affiliate program is free,
                you may need to invest in:
                <ul>
                  <li>Marketing tools and advertising</li>
                  <li>Content creation</li>
                  <li>Education and training</li>
                  <li>Time and effort</li>
                </ul>
              </li>
              <li>
                <strong>Material Connection Disclosure:</strong> As an affiliate, you MUST disclose
                your affiliate relationship when promoting our products. Failure to do so violates
                FTC guidelines and may result in termination from our program.
              </li>
            </ol>
            <p>
              <strong>Example Disclosure:</strong> "I'm an affiliate of Quantum Strategies and may
              earn a commission if you purchase through my link, at no additional cost to you."
            </p>
            <p>
              By participating in our affiliate program, you acknowledge that you understand these
              disclosures and agree to comply with all FTC guidelines.
            </p>
            <p>
              <strong>
                By accessing or using Quantum Strategies, you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Service.
              </strong>
            </p>
            <p>
              <strong>Last Updated:</strong> [INSERT DATE]
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
