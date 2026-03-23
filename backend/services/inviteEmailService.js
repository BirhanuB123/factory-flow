const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Send tenant-admin invite email when SMTP is configured.
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_PUBLIC_URL (for link text)
 * @returns {{ sent: boolean, error?: string }}
 */
async function sendTenantAdminInvite({ to, employeeName, tenantDisplayName, inviteUrl }) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { sent: false };
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || user || 'noreply@localhost';

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    const subject = `Your ${tenantDisplayName || 'company'} ERP account`;
    const text = [
      `Hello ${employeeName},`,
      '',
      `An administrator created your account for ${tenantDisplayName || 'your organization'} on Integra ERP.`,
      'Open the link below to set your password and sign in:',
      '',
      inviteUrl,
      '',
      'This link expires in 7 days. If you did not expect this email, you can ignore it.',
    ].join('\n');

    const html = `<p>Hello ${escapeHtml(employeeName)},</p>
<p>An administrator created your account for <strong>${escapeHtml(tenantDisplayName || 'your organization')}</strong> on Integra ERP.</p>
<p><a href="${escapeHtml(inviteUrl)}">Set your password</a></p>
<p style="color:#666;font-size:12px;">This link expires in 7 days.</p>`;

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    logger.warn({ err, to }, 'invite email send failed');
    return { sent: false, error: err.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendTenantAdminInvite };
