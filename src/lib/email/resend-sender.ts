import { Resend } from 'resend';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
  fromName: string;
}

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
    _client = new Resend(apiKey);
  }
  return _client;
}

export async function sendEmailViaResend(params: EmailParams): Promise<string> {
  const resend = getClient();

  const { data, error } = await resend.emails.send({
    from: `${params.fromName} <${params.fromEmail}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) throw new Error(`Resend send failed: ${error.message}`);
  return data?.id || 'sent';
}
