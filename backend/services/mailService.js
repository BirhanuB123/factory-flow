const logger = require('../config/logger');

/**
 * Optional nodemailer: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MANAGER_EMAILS (comma-separated).
 */
async function sendManagerDigest() {
  const emails = (process.env.MANAGER_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (!emails.length) {
    return { sent: false, message: 'MANAGER_EMAILS not set' };
  }
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { sent: false, message: 'SMTP_HOST not set' };
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    const subject = `[Factory Flow] Manager summary ${new Date().toISOString().slice(0, 10)}`;
    const text =
      'Scheduled summary placeholder. Connect dashboards or attach CSV exports in a future iteration.';
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@factory-flow',
      to: emails.join(','),
      subject,
      text,
    });
    return { sent: true, to: emails };
  } catch (e) {
    logger.warn({ err: e.message }, 'manager digest email failed');
    return { sent: false, message: e.message };
  }
}

async function sendPOTemplate(po, toEmail) {
  if (!toEmail) return { sent: false };
  const host = process.env.SMTP_HOST;
  if (!host) return { sent: false, message: 'SMTP not configured' };
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: `Purchase Order ${po.poNumber || po._id}`,
      text: `PO ${po.poNumber}\nSupplier: ${po.supplierName}\nSee ERP for details.`,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, message: e.message };
  }
}

async function sendInvoiceNotice(invoice, clientEmail) {
  if (!clientEmail) return { sent: false };
  const host = process.env.SMTP_HOST;
  if (!host) return { sent: false };
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: clientEmail,
      subject: `Invoice ${invoice.invoiceId}`,
      text: `Amount: ${invoice.amount}\nDue: ${invoice.dueDate}`,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, message: e.message };
  }
}

module.exports = { sendManagerDigest, sendPOTemplate, sendInvoiceNotice };
