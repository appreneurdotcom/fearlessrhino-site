/**
 * Email sending, with no hard dependency on one provider.
 *
 *  - If RESEND_API_KEY is set, sends via the Resend HTTP API.
 *  - Else if SMTP_HOST is set, sends via SMTP (Nodemailer) — works with a
 *    Gmail app password, Zoho, Outlook, your registrar's mailbox, etc.
 *  - Else, nothing is actually emailed: the message is just logged and the
 *    caller is told sending failed, so it can still be recorded in the
 *    inquiries log instead of silently disappearing.
 *
 * See .env.example for exactly which variables to set.
 */

const nodemailer = require('nodemailer');

let smtpTransport = null;
function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;
  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return smtpTransport;
}

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

async function sendViaResend({ to, from, subject, text, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: [to],
      from,
      subject,
      text,
      reply_to: replyTo || undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

async function sendViaSmtp({ to, from, subject, text, replyTo }) {
  const transport = getSmtpTransport();
  await transport.sendMail({ to, from, subject, text, replyTo: replyTo || undefined });
}

/**
 * @param {{subject: string, text: string, replyTo?: string}} message
 * @returns {Promise<{sent: boolean, error: string|null}>}
 */
async function sendInquiryEmail(message) {
  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM || 'Fearless Rhino Website <onboarding@resend.dev>';

  if (!to) {
    const error = 'EMAIL_TO is not set — see .env.example.';
    console.warn(`[mailer] ${error}`);
    return { sent: false, error };
  }

  if (!isConfigured()) {
    const error = 'No email provider configured (set RESEND_API_KEY or SMTP_HOST) — see .env.example.';
    console.warn(`[mailer] ${error} Message was NOT sent:\n${message.subject}\n${message.text}`);
    return { sent: false, error };
  }

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, from, ...message });
    } else {
      await sendViaSmtp({ to, from, ...message });
    }
    return { sent: true, error: null };
  } catch (err) {
    console.error(`[mailer] Failed to send email: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendInquiryEmail, isConfigured };
