import nodemailer from 'nodemailer';
import { config } from '../config';
import { emailTemplates } from './email.templates';
import { getSmtp, SmtpConfig } from './appSettings.service';

// The transporter is built lazily from the CURRENT SMTP settings (admin Settings
// page → DB, falling back to env) and cached. It is rebuilt automatically when
// the settings change, so saving SMTP in the UI takes effect without a restart.
let cachedTransporter: nodemailer.Transporter | null = null;
let cachedSig = '';

async function getTransporter(): Promise<{ transporter: nodemailer.Transporter; smtp: SmtpConfig } | null> {
  const smtp = await getSmtp();
  if (!smtp.user || !smtp.password) return null;
  const sig = `${smtp.host}|${smtp.port}|${smtp.secure}|${smtp.user}|${smtp.password}`;
  if (!cachedTransporter || sig !== cachedSig) {
    cachedTransporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure, // false for 587 (STARTTLS), true for 465
      auth: { user: smtp.user, pass: smtp.password },
      tls: { minVersion: 'TLSv1.2' },
    });
    cachedSig = sig;
  }
  return { transporter: cachedTransporter, smtp };
}

export interface EmailAttachment {
  content: string; // base64 encoded
  filename: string;
  type: string; // MIME type
  disposition?: 'attachment' | 'inline';
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface NotificationEmailData {
  recipientName: string;
  notificationType: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Validate and sanitize a list of recipient email addresses.
 *
 * Guards against CVE-2025-14874 (nodemailer DoS via crafted email header):
 * the attack embeds CRLF sequences (\r or \n) inside an address to inject
 * extra headers or fold the message in a way that hangs nodemailer's parser.
 *
 * Rules enforced:
 *  1. No carriage-return or line-feed characters (CRLF injection).
 *  2. Basic RFC-5321 shape: local-part @ domain — rejects obviously malformed
 *     strings before they ever reach the SMTP library.
 *
 * Throws synchronously so the caller never reaches sendMail() with bad input.
 */
function validateRecipients(to: string | string[]): void {
  const addresses = Array.isArray(to) ? to : [to];
  // Loose but sufficient: catches injections and obvious garbage without
  // reimplementing a full RFC-5321 parser.
  const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  const CRLF_RE  = /[\r\n]/;

  for (const addr of addresses) {
    if (CRLF_RE.test(addr)) {
      throw new Error(
        `Email address contains illegal CRLF characters (possible header injection): "${addr}"`
      );
    }
    const trimmed = addr.trim();
    if (!EMAIL_RE.test(trimmed)) {
      throw new Error(`Invalid email address format: "${addr}"`);
    }
  }
}

export const emailService = {
  /**
   * Send an email using Gmail SMTP
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const tp = await getTransporter();
    if (!tp) {
      console.warn('SMTP not configured, skipping email send');
      return false;
    }

    // Validate recipients before touching nodemailer — guards CVE-2025-14874.
    validateRecipients(options.to);

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${tp.smtp.fromName}" <${tp.smtp.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((att) => ({
          content: Buffer.from(att.content, 'base64'),
          filename: att.filename,
          contentType: att.type,
          contentDisposition: att.disposition || 'attachment',
        }));
      }

      const info = await tp.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId, '→', mailOptions.to);
      return true;
    } catch (error: any) {
      console.error('Failed to send email:', {
        message: error.message,
        code: error.code,
        command: error.command,
      });
      return false;
    }
  },

  /**
   * Whether SMTP is currently configured (Settings page or env).
   */
  async isConfigured(): Promise<boolean> {
    return (await getTransporter()) !== null;
  },

  /**
   * Send a test email to verify the SMTP settings. Throws with the underlying
   * SMTP error so the Settings UI can show why it failed.
   */
  async sendTestEmail(to: string): Promise<void> {
    const tp = await getTransporter();
    if (!tp) throw new Error('SMTP is not configured. Fill in the email settings first.');
    validateRecipients(to);
    await tp.transporter.sendMail({
      from: `"${tp.smtp.fromName}" <${tp.smtp.fromEmail}>`,
      to,
      subject: 'Test email from your PMT/HRMS server',
      html: '<p>✅ Success! Your email (SMTP) settings are working. This is a test message.</p>',
    });
  },

  /**
   * Send email verification email
   */
  async sendEmailVerification(
    email: string,
    userName: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${config.frontend.url}/verify-email?token=${verificationToken}`;

    const html = emailTemplates.emailVerification({
      userName,
      verificationUrl,
      expiresIn: '24 hours',
    });

    return this.sendEmail({
      to: email,
      subject: 'Verify your ProjectFlow email address',
      html,
    });
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    email: string,
    userName: string,
    resetToken: string
  ): Promise<boolean> {
    const html = emailTemplates.passwordReset({
      userName,
      otp: resetToken,
      expiresIn: '1 hour',
    });

    return this.sendEmail({
      to: email,
      subject: 'Reset your ProjectFlow password',
      html,
    });
  },

  /**
   * Send notification email
   */
  async sendNotificationEmail(
    email: string,
    data: NotificationEmailData
  ): Promise<boolean> {
    const html = emailTemplates.notification(data);

    return this.sendEmail({
      to: email,
      subject: `[ProjectFlow] ${data.title}`,
      html,
    });
  },

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(email: string, userName: string): Promise<boolean> {
    const html = emailTemplates.welcome({
      userName,
      loginUrl: `${config.frontend.url}/login`,
    });

    return this.sendEmail({
      to: email,
      subject: 'Welcome to ProjectFlow!',
      html,
    });
  },

  /**
   * Strip HTML tags for plain text version
   */
  stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },
};
