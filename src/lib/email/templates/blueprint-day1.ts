import type { EmailContent } from '@/types/database';

const BASE_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; color: #1a1a1a; margin: 0; padding: 0; background: #f9f8f6; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4de; }
  .body { padding: 48px 44px; }
  p { margin: 0 0 20px 0; font-size: 16px; }
  .gate { border-left: 3px solid #030048; padding: 16px 20px; margin: 28px 0; font-style: italic; color: #333; font-size: 15px; }
  .sig { margin-top: 36px; color: #555; }
  .foot { padding: 24px 44px; border-top: 1px solid #e8e4de; font-size: 13px; color: #888; }
  .foot a { color: #888; }
  a.cta { display: inline-block; background: #030048; color: #fff !important; padding: 14px 28px; text-decoration: none; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.03em; margin: 8px 0 24px; }
`;

export function getBlueprintDay1Template(content: EmailContent) {
  const name = (content.user_first_name || 'there').split(' ')[0];
  const gate = content.closing_gate?.trim() || '';
  const dashboardUrl = content.dashboard_url || 'https://www.quantumstrategies.online/dashboard/products';

  const subject = `One finding from your ${content.product_name}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_STYLES}</style>
</head>
<body>
<div class="wrap">
  <div class="body">
    <p>${name} —</p>
    <p>Your blueprint surfaced this:</p>
    ${gate ? `<div class="gate">"${gate}"</div>` : ''}
    <p>That's a structural finding. Not a summary.</p>
    <p>What's your plan for it?</p>
    <p>Reply with one sentence.</p>
    <p>Or return to your results here:</p>
    <a href="${dashboardUrl}" class="cta">View Your Blueprint</a>
    <p class="sig">— Austin<br><span style="font-size:13px;color:#888;">Quantum Strategies</span></p>
  </div>
  <div class="foot">
    <a href="https://www.quantumstrategies.online">quantumstrategies.online</a>
  </div>
</div>
</body>
</html>`;

  const text = `${name} —

Your blueprint surfaced this:

"${gate}"

That's a structural finding. Not a summary.

What's your plan for it?

Reply with one sentence.

Or view your results: ${dashboardUrl}

— Austin
Quantum Strategies
quantumstrategies.online`;

  return { subject, html, text };
}
