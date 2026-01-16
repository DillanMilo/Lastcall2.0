import { Resend } from 'resend';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'team@lastcall.app';

// Debug logging for configuration
console.log('[Email Config] RESEND_API_KEY set:', !!resendApiKey);
console.log('[Email Config] RESEND_API_KEY starts with:', resendApiKey?.substring(0, 6) + '...');
console.log('[Email Config] RESEND_FROM_EMAIL:', fromEmail);

if (!resendApiKey) {
  console.warn('[Email Config] WARNING: RESEND_API_KEY is not set. Email functionality will be disabled.');
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const FROM_EMAIL = fromEmail;

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Send an email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const fromAddress = `LastCall <${FROM_EMAIL}>`;

  console.log('[Email] Attempting to send email...');
  console.log('[Email] To:', to);
  console.log('[Email] From:', fromAddress);
  console.log('[Email] Subject:', subject);
  console.log('[Email] Resend client initialized:', !!resend);

  if (!resend) {
    console.error('[Email] FAILED: Resend client is not initialized. Check RESEND_API_KEY.');
    return { success: false, error: 'Email service not configured - missing RESEND_API_KEY' };
  }

  try {
    console.log('[Email] Calling Resend API...');

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    if (error) {
      console.error('[Email] FAILED: Resend API returned error:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message };
    }

    console.log('[Email] SUCCESS: Email sent! Message ID:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorDetails = err instanceof Error ? err.stack : String(err);
    console.error('[Email] EXCEPTION:', errorMessage);
    console.error('[Email] Stack trace:', errorDetails);
    return { success: false, error: errorMessage };
  }
}

/**
 * Simple HTML to plain text conversion
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
