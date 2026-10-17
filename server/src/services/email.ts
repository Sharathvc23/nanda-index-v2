import { Resend } from 'resend';
import { buildConfig } from '../config/index.js';

export async function sendVerificationEmail(
  to: string,
  token: string,
  orgId: string,
): Promise<void> {
  const config = buildConfig();
  const verifyUrl = `${config.oauth.callbackBaseUrl}/api/v1/verify-email?token=${token}`;

  if (config.email.smtpUrl === 'log') {
    console.log(`[email] verification link for org "${orgId}" → ${verifyUrl}`);
    return;
  }

  const resend = new Resend(config.email.smtpUrl);
  const { error } = await resend.emails.send({
    from:    config.email.fromAddress,
    to,
    subject: `Verify your NANDA Index registration for ${orgId}`,
    text:    `Click to verify your email and activate your organization:\n\n${verifyUrl}\n\nThis link is valid for 24 hours.`,
    html:    `<p>Click the link below to verify your email and activate your organization on the NANDA Index:</p>
              <p><a href="${verifyUrl}">${verifyUrl}</a></p>
              <p>This link is valid for 24 hours.</p>`,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const config = buildConfig();
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const ttlMinutes = config.auth.resetTokenTtlMinutes;

  if (config.email.smtpUrl === 'log') {
    console.log(`[email] password reset link for "${to}" → ${resetUrl}`);
    return;
  }

  const resend = new Resend(config.email.smtpUrl);
  const { error } = await resend.emails.send({
    from:    config.email.fromAddress,
    to,
    subject: 'Reset your NANDA Index password',
    text:    `We received a request to reset your password. Click the link below to choose a new one:\n\n${resetUrl}\n\nThis link is valid for ${ttlMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
    html:    `<p>We received a request to reset your password. Click the link below to choose a new one:</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p>This link is valid for ${ttlMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>`,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

/**
 * Emails the link that proves the account owns its sign-up address. The link
 * opens a web page that verifies on a button press (POST), not on load, so
 * mail scanners that prefetch links cannot verify an account by accident.
 */
export async function sendAccountVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const config = buildConfig();
  const verifyUrl = `${config.frontendUrl}/verify-account?token=${token}`;

  if (config.email.smtpUrl === 'log') {
    console.log(`[email] account verification link for "${to}" → ${verifyUrl}`);
    return;
  }

  const resend = new Resend(config.email.smtpUrl);
  const { error } = await resend.emails.send({
    from:    config.email.fromAddress,
    to,
    subject: 'Verify your NANDA Index account email',
    text:    `Confirm this email address to start registering and managing agents on the NANDA Index:\n\n${verifyUrl}\n\nThis link is valid for 24 hours. If you didn't create an account, you can safely ignore this email.`,
    html:    `<p>Confirm this email address to start registering and managing agents on the NANDA Index:</p>
              <p><a href="${verifyUrl}">${verifyUrl}</a></p>
              <p>This link is valid for 24 hours. If you didn't create an account, you can safely ignore this email.</p>`,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
