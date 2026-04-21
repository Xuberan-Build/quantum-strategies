import type { EmailContent } from '@/types/database';

const BASE_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; color: #1a1a1a; margin: 0; padding: 0; background: #f9f8f6; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4de; }
  .body { padding: 48px 44px; }
  p { margin: 0 0 20px 0; font-size: 16px; }
  .two-col { display: flex; gap: 24px; margin: 28px 0; }
  .col { flex: 1; border: 1px solid #e8e4de; padding: 20px; }
  .col-label { font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #030048; margin-bottom: 10px; }
  a.cta { display: inline-block; background: #030048; color: #fff !important; padding: 14px 28px; text-decoration: none; font-family: -apple-system, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.03em; margin: 8px 0 24px; }
  .sig { margin-top: 36px; color: #555; }
  .foot { padding: 24px 44px; border-top: 1px solid #e8e4de; font-size: 13px; color: #888; }
  .foot a { color: #888; }
`;

export function getBlueprintDay7Template(content: EmailContent) {
  const name = (content.user_first_name || 'there').split(' ')[0];
  const dashboardUrl = content.dashboard_url || 'https://www.quantumstrategies.online/dashboard/products';
  const riteUrl = 'https://www.quantumstrategies.online/the-rite-system?utm_source=email&utm_medium=blueprint_day7&utm_campaign=followup';

  const subject = `Week one — where are you?`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_STYLES}</style>
</head>
<body>
<div class="wrap">
  <div class="body">
    <p>${name} —</p>
    <p>One week since your ${content.product_name}.</p>
    <p>Either the constraint your blueprint identified has started to move, or it hasn't.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:28px 0;">
      <tr>
        <td width="48%" valign="top" style="border:1px solid #e8e4de;padding:20px;">
          <div style="font-family:-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#030048;margin-bottom:10px;">If it has</div>
          <p style="margin:0;font-size:15px;">Post your results in #rites-of-passage. That creates signal for others who haven't moved yet.</p>
        </td>
        <td width="4%"></td>
        <td width="48%" valign="top" style="border:1px solid #e8e4de;padding:20px;">
          <div style="font-family:-apple-system,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#030048;margin-bottom:10px;">If it hasn't</div>
          <p style="margin:0;font-size:15px;">Reply here with what's in the way. One sentence is enough.</p>
        </td>
      </tr>
    </table>
    <p>Either way, the next step is visible.</p>
    <a href="${dashboardUrl}" class="cta">Return to Your Blueprint</a>
    <p style="font-size:14px;color:#555;">Haven't completed all three orientations yet? <a href="${riteUrl}" style="color:#030048;">View the full Rite system.</a></p>
    <p class="sig">— Austin<br><span style="font-size:13px;color:#888;">Quantum Strategies</span></p>
  </div>
  <div class="foot">
    <a href="https://www.quantumstrategies.online">quantumstrategies.online</a>
  </div>
</div>
</body>
</html>`;

  const text = `${name} —

One week since your ${content.product_name}.

Either the constraint your blueprint identified has started to move, or it hasn't.

IF IT HAS:
Post your results in #rites-of-passage. That creates signal for others who haven't moved yet.

IF IT HASN'T:
Reply here with what's in the way. One sentence is enough.

Either way, the next step is visible.

View your blueprint: ${dashboardUrl}

— Austin
Quantum Strategies
quantumstrategies.online`;

  return { subject, html, text };
}
