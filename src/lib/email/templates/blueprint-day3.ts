import type { EmailContent } from '@/types/database';

const BASE_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; color: #1a1a1a; margin: 0; padding: 0; background: #f9f8f6; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4de; }
  .body { padding: 48px 44px; }
  p { margin: 0 0 20px 0; font-size: 16px; }
  .tip { background: #faf9f7; border: 1px solid #e8e4de; padding: 20px 24px; margin: 28px 0; }
  .tip-label { font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #030048; margin-bottom: 10px; }
  .sig { margin-top: 36px; color: #555; }
  .foot { padding: 24px 44px; border-top: 1px solid #e8e4de; font-size: 13px; color: #888; }
  .foot a { color: #888; }
`;

export function getBlueprintDay3Template(content: EmailContent) {
  const name = (content.user_first_name || 'there').split(' ')[0];
  const gate = content.closing_gate?.trim() || '';

  const subject = `Three days out — ${content.product_name}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_STYLES}</style>
</head>
<body>
<div class="wrap">
  <div class="body">
    <p>${name} —</p>
    <p>Three days since your orientation.</p>
    ${gate ? `<p>The constraint your blueprint identified — <em>"${gate}"</em> — is either in motion or it isn't.</p>` : `<p>The constraint your blueprint identified is either in motion or it isn't.</p>`}
    <div class="tip">
      <div class="tip-label">Pro tip</div>
      <p style="margin:0;">Most people treat the finding as something to address eventually. That's where the gap compounds. Address it first — before the next project, the next product, the next conversation. The constraint doesn't disappear on its own.</p>
    </div>
    <p>If you've started: reply and tell me what's moved.</p>
    <p>If you haven't: reply and tell me what's in the way.</p>
    <p class="sig">— Austin<br><span style="font-size:13px;color:#888;">Quantum Strategies</span></p>
  </div>
  <div class="foot">
    <a href="https://www.quantumstrategies.online">quantumstrategies.online</a>
  </div>
</div>
</body>
</html>`;

  const text = `${name} —

Three days since your orientation.

${gate ? `The constraint your blueprint identified — "${gate}" — is either in motion or it isn't.` : `The constraint your blueprint identified is either in motion or it isn't.`}

PRO TIP:
Most people treat the finding as something to address eventually. That's where the gap compounds. Address it first — before the next project, the next product, the next conversation. The constraint doesn't disappear on its own.

If you've started: reply and tell me what's moved.
If you haven't: reply and tell me what's in the way.

— Austin
Quantum Strategies
quantumstrategies.online`;

  return { subject, html, text };
}
