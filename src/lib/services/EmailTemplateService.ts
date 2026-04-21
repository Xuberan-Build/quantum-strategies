/**
 * Email Template Service
 * Generates personalized email content for automated sequences
 */

import type { EmailContent } from '@/types/database';
import { APP_URL } from '@/lib/config/urls';
import { getBlueprintDay1Template } from '@/lib/email/templates/blueprint-day1';
import { getBlueprintDay3Template } from '@/lib/email/templates/blueprint-day3';
import { getBlueprintDay7Template } from '@/lib/email/templates/blueprint-day7';

export interface EmailTemplate {
  subject: string;
  textContent: string;
  htmlContent: string;
}

export class EmailTemplateService {
  /**
   * Generate affiliate invitation email
   * Sent 30 minutes after deliverable completion
   */
  static generateAffiliateInvitation(content: EmailContent, userId?: string): EmailTemplate {
    const {
      user_first_name,
      product_name,
      deliverable_preview,
    } = content;

    const firstName = this.getFirstName(user_first_name);
    const preview = this.getDeliverablePreview(deliverable_preview);

    const subject = `${firstName}, You're Ready to Share ${product_name} 🌟`;

    const textContent = this.generateAffiliateInvitationText(firstName, product_name, preview, userId);
    const htmlContent = this.generateAffiliateInvitationHTML(firstName, product_name, preview, userId);

    return { subject, textContent, htmlContent };
  }

  /**
   * Extract first name from full name
   */
  static getFirstName(name: string | null): string {
    if (!name) return 'there';
    const firstName = name.split(' ')[0];
    return firstName || 'there';
  }

  /**
   * Get deliverable preview (first 150 characters)
   */
  static getDeliverablePreview(deliverable: string): string {
    if (!deliverable) return '';

    // Remove markdown headers and formatting
    const cleanText = deliverable
      .replace(/^#+\s/gm, '') // Remove markdown headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italic
      .trim();

    if (cleanText.length <= 150) return cleanText;
    return cleanText.substring(0, 150) + '...';
  }

  /**
   * Generate plain text version of affiliate invitation
   */
  private static generateAffiliateInvitationText(
    firstName: string,
    productName: string,
    preview: string,
    userId?: string
  ): string {
    const siteUrl = APP_URL;
    const optOutUrl = userId
      ? `${siteUrl}/api/affiliate/opt-out-email?user_id=${userId}`
      : `${siteUrl}/api/affiliate/opt-out-email`;

    return `Hi ${firstName},

Congrats on completing your ${productName} blueprint! 🎉

${preview ? `Here's a sneak peek of what you created:\n\n"${preview}"\n\n` : ''}You've just experienced something transformative. And here's the exciting part...

**You can help others discover this too - and earn while you do it.**

We've created an affiliate program that lets you share ${productName} with your network and earn commissions on every sale. It's our way of saying thank you for being part of this journey.

**Here's how it works:**

Choose Your Track:
• Community Builder (30%) - Build a team and earn override commissions
• High Performer (40%) - Higher commissions, still build a team
• Independent (60%) - Maximum earnings, work solo

Your next step is simple:
1. Click the link below to join the affiliate program
2. Get your unique referral link
3. Share it with your network
4. Earn commissions on every sale

Ready to turn your transformation into impact (and income)?

Join the Affiliate Program: ${siteUrl}/dashboard/affiliate

If you're not interested right now, that's totally okay. You can always access this later from your dashboard.

To your quantum success,
The Quantum Strategies Team

---
Not interested in affiliate opportunities? Click here to opt out: ${optOutUrl}
`;
  }

  /**
   * Generate HTML version of affiliate invitation
   */
  private static generateAffiliateInvitationHTML(
    firstName: string,
    productName: string,
    preview: string,
    userId?: string
  ): string {
    const siteUrl = APP_URL;
    const optOutUrl = userId
      ? `${siteUrl}/api/affiliate/opt-out-email?user_id=${userId}`
      : `${siteUrl}/api/affiliate/opt-out-email`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join Our Affiliate Program</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #1f2937;
    }
    .preview-box {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 30px 0;
      border-radius: 8px;
    }
    .preview-text {
      font-style: italic;
      color: #78350f;
      margin: 0;
      line-height: 1.8;
    }
    .main-text {
      font-size: 16px;
      line-height: 1.8;
      color: #4b5563;
      margin-bottom: 20px;
    }
    .highlight {
      font-weight: 600;
      color: #1f2937;
    }
    .tracks {
      background-color: #f9fafb;
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
    }
    .track-item {
      margin-bottom: 15px;
      padding-left: 10px;
    }
    .track-title {
      font-weight: 600;
      color: #7c3aed;
      font-size: 16px;
    }
    .track-description {
      color: #6b7280;
      font-size: 14px;
      margin-top: 5px;
    }
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 18px;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .steps {
      background-color: #f3f4f6;
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
    }
    .step {
      margin-bottom: 12px;
      font-size: 15px;
      color: #374151;
    }
    .step-number {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      margin-right: 10px;
      font-size: 14px;
      font-weight: 600;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 14px;
      color: #6b7280;
      margin: 5px 0;
    }
    .opt-out {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 20px;
    }
    .opt-out a {
      color: #7c3aed;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌟 You're Ready to Share!</h1>
    </div>

    <div class="content">
      <p class="greeting">Hi ${firstName},</p>

      <p class="main-text">
        Congrats on completing your <span class="highlight">${productName}</span> blueprint! 🎉
      </p>

      ${preview ? `
      <div class="preview-box">
        <p class="preview-text">"${preview}"</p>
      </div>
      ` : ''}

      <p class="main-text">
        You've just experienced something transformative. And here's the exciting part...
      </p>

      <p class="main-text">
        <span class="highlight">You can help others discover this too - and earn while you do it.</span>
      </p>

      <p class="main-text">
        We've created an affiliate program that lets you share ${productName} with your network and earn commissions on every sale. It's our way of saying thank you for being part of this journey.
      </p>

      <div class="tracks">
        <h3 style="margin-top: 0; color: #1f2937;">Choose Your Track:</h3>

        <div class="track-item">
          <div class="track-title">• Community Builder (30%)</div>
          <div class="track-description">Build a team and earn override commissions</div>
        </div>

        <div class="track-item">
          <div class="track-title">• High Performer (40%)</div>
          <div class="track-description">Higher commissions, still build a team</div>
        </div>

        <div class="track-item">
          <div class="track-title">• Independent (60%)</div>
          <div class="track-description">Maximum earnings, work solo</div>
        </div>
      </div>

      <div class="steps">
        <h3 style="margin-top: 0; color: #1f2937;">Your Next Steps:</h3>
        <div class="step">
          <span class="step-number">1</span>
          Click the button below to join the affiliate program
        </div>
        <div class="step">
          <span class="step-number">2</span>
          Get your unique referral link
        </div>
        <div class="step">
          <span class="step-number">3</span>
          Share it with your network
        </div>
        <div class="step">
          <span class="step-number">4</span>
          Earn commissions on every sale
        </div>
      </div>

      <div class="cta-section">
        <a href="${siteUrl}/dashboard/affiliate" class="cta-button">
          Join the Affiliate Program
        </a>
      </div>

      <p class="main-text" style="text-align: center; font-size: 14px; color: #6b7280;">
        If you're not interested right now, that's totally okay.<br>
        You can always access this later from your dashboard.
      </p>
    </div>

    <div class="footer">
      <p class="footer-text">To your quantum success,</p>
      <p class="footer-text"><strong>The Quantum Strategies Team</strong></p>

      <div class="opt-out">
        Not interested in affiliate opportunities?
        <a href="${optOutUrl}">Click here to opt out</a>
      </div>
    </div>
  </div>
</body>
</html>
`;
  }

  static generateBlueprintDay1(content: EmailContent): EmailTemplate {
    const { subject, html, text } = getBlueprintDay1Template(content);
    return { subject, htmlContent: html, textContent: text };
  }

  static generateBlueprintDay3(content: EmailContent): EmailTemplate {
    const { subject, html, text } = getBlueprintDay3Template(content);
    return { subject, htmlContent: html, textContent: text };
  }

  static generateBlueprintDay7(content: EmailContent): EmailTemplate {
    const { subject, html, text } = getBlueprintDay7Template(content);
    return { subject, htmlContent: html, textContent: text };
  }

  static extractClosingGate(content: string): string | null {
    if (!content) return null;
    const match = content.match(/When\s+[\s\S]{20,600}(?:focused hours|per week|enabling)[^.]*\./);
    if (match) return match[0].trim();
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.at(-1) ?? null;
  }
}
