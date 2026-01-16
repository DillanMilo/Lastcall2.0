import { Resend } from 'resend';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey && process.env.NODE_ENV === 'production') {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'team@lastcall.app';

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
  if (!resend) {
    console.warn('Email not sent: Resend is not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `LastCall <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error sending email:', errorMessage);
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
