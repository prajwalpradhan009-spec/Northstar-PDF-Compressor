const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter;

// Without explicit timeouts a blocked/hanging SMTP port keeps sendMail pending
// for nodemailer's multi-minute defaults before it fails, so the reset request
// stalls and the real cause is hard to see. Fail fast so the actual error is
// logged promptly (see the controller's catch block).
const SMTP_TIMEOUT_MS = 10000;

function getTransporter() {
  if (!config.email.configured) {
    throw new Error('SMTP email delivery is not configured.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      ...config.email.smtp,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }
  return transporter;
}

async function sendPasswordResetCode(email, code) {
  await getTransporter().sendMail({
    from: config.email.from,
    to: email,
    subject: 'Northstar PDF Tools - Password Reset OTP',
    text: [
      `Your Northstar PDF Tools password reset verification code is: ${code}`,
      `This code will expire in ${config.email.otpExpiresMinutes} minutes.`,
      'Do not share this code with anyone.',
      'If you did not request a password reset, you can ignore this email.',
    ].join('\n\n'),
    html: [
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#080b18;font-family:Arial,Helvetica,sans-serif;color:#eef2ff">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080b18;padding:32px 12px"><tr><td align="center">',
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#11162a;border:1px solid #293451;border-radius:18px;overflow:hidden">',
      '<tr><td style="padding:28px 32px 12px"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#75dcff;font-weight:700">Northstar PDF Tools</div>',
      '<h1 style="font-size:24px;line-height:1.3;margin:18px 0 8px;color:#fff">Reset your password</h1>',
      '<p style="font-size:15px;line-height:1.6;color:#b8c2db;margin:0">Use this verification code to continue resetting your password.</p></td></tr>',
      `<tr><td align="center" style="padding:20px 32px"><div style="display:inline-block;background:#0a1021;border:1px solid #344260;border-radius:12px;padding:17px 24px;font-size:32px;letter-spacing:10px;font-weight:700;color:#8be9ff;font-variant-numeric:tabular-nums">${code}</div>`,
      `<p style="font-size:14px;color:#b8c2db;margin:16px 0 0">This code expires in <strong style="color:#fff">${config.email.otpExpiresMinutes} minutes</strong>.</p></td></tr>`,
      '<tr><td style="padding:8px 32px 28px"><div style="border-top:1px solid #293451;padding-top:18px"><p style="font-size:14px;line-height:1.6;color:#ffd29a;margin:0"><strong>Keep your account secure.</strong> Do not share this code with anyone. Northstar will never ask you to send it to us.</p>',
      '<p style="font-size:12px;line-height:1.6;color:#8290ae;margin:18px 0 0">If you did not request a password reset, you can safely ignore this email.</p></div></td></tr>',
      '</table><p style="font-size:11px;color:#687590;margin:18px 0 0">Northstar PDF Tools</p></td></tr></table></body></html>',
    ].join(''),
  });
}

module.exports = { sendPasswordResetCode };
