/**
 * Email templates for ProjectFlow
 * All templates return HTML strings
 */

/** Escape user-supplied strings before interpolation into HTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .card { background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .header { text-align: center; margin-bottom: 30px; }
  .logo { font-size: 24px; font-weight: bold; color: #4F46E5; }
  .content { margin-bottom: 30px; }
  .button { display: inline-block; background: #4F46E5; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 20px 0; }
  .button:hover { background: #4338CA; }
  .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  .muted { color: #666; font-size: 14px; }
  h1 { color: #1a1a1a; font-size: 24px; margin: 0 0 20px 0; }
  p { margin: 0 0 15px 0; }
`;

function wrapTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">ProjectFlow</div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>This email was sent by ProjectFlow AI</p>
      <p>If you didn't request this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export interface EmailVerificationData {
  userName: string;
  verificationUrl: string;
  expiresIn: string;
}

export interface PasswordResetData {
  userName: string;
  otp: string;
  expiresIn: string;
}

export interface NotificationData {
  recipientName: string;
  notificationType: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}

export interface WelcomeData {
  userName: string;
  loginUrl: string;
}

export const emailTemplates = {
  /**
   * Email verification template
   */
  emailVerification(data: EmailVerificationData): string {
    const userName = escapeHtml(data.userName);
    const expiresIn = escapeHtml(data.expiresIn);
    return wrapTemplate(`
      <div class="content">
        <h1>Verify your email address</h1>
        <p>Hi ${userName},</p>
        <p>Thanks for signing up for ProjectFlow! Please verify your email address by clicking the button below:</p>
        <p style="text-align: center;">
          <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
        </p>
        <p class="muted">This link will expire in ${expiresIn}.</p>
        <p class="muted">If you didn't create an account with ProjectFlow, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p class="muted" style="font-size: 12px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p class="muted" style="font-size: 12px; word-break: break-all;">${escapeHtml(data.verificationUrl)}</p>
      </div>
    `);
  },

  /**
   * Password reset template
   */
  passwordReset(data: PasswordResetData): string {
    const userName = escapeHtml(data.userName);
    const otp = escapeHtml(data.otp);
    const expiresIn = escapeHtml(data.expiresIn);
    return wrapTemplate(`
      <div class="content">
        <h1>Reset your password</h1>
        <p>Hi ${userName},</p>
        <p>We received a request to reset your password. Enter the 6-digit OTP below on the login page to create a new password:</p>
        <p style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a; background: #f4f4f5; border-radius: 8px; padding: 12px 24px;">${otp}</span>
        </p>
        <p class="muted">This OTP will expire in ${expiresIn}.</p>
        <p class="muted">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
    `);
  },

  /**
   * Notification template
   */
  notification(data: NotificationData): string {
    const title = escapeHtml(data.title);
    const recipientName = escapeHtml(data.recipientName);
    const message = escapeHtml(data.message);
    const actionText = escapeHtml(data.actionText || 'View Details');
    const actionButton = data.actionUrl
      ? `<p style="text-align: center;"><a href="${data.actionUrl}" class="button">${actionText}</a></p>`
      : '';

    return wrapTemplate(`
      <div class="content">
        <h1>${title}</h1>
        <p>Hi ${recipientName},</p>
        <p>${message}</p>
        ${actionButton}
      </div>
    `);
  },

  /**
   * Welcome template
   */
  welcome(data: WelcomeData): string {
    const userName = escapeHtml(data.userName);
    return wrapTemplate(`
      <div class="content">
        <h1>Welcome to ProjectFlow!</h1>
        <p>Hi ${userName},</p>
        <p>Your account has been created successfully. ProjectFlow is an AI-powered project management platform that helps you organize, track, and complete your projects efficiently.</p>
        <p>Here's what you can do with ProjectFlow:</p>
        <ul style="margin: 15px 0; padding-left: 20px;">
          <li>Create and manage projects with customizable workflows</li>
          <li>Track issues and tasks on Kanban boards</li>
          <li>Plan and execute sprints with agile methodology</li>
          <li>Get AI-powered suggestions for task assignment and estimation</li>
          <li>Collaborate with your team in real-time</li>
        </ul>
        <p style="text-align: center;">
          <a href="${data.loginUrl}" class="button">Get Started</a>
        </p>
        <p class="muted">If you have any questions, feel free to reach out to our support team.</p>
      </div>
    `);
  },

  /**
   * Scheduled report email template
   */
  scheduledReport(data: {
    recipientName: string;
    reportName: string;
    reportType: string;
    projectName?: string;
    generatedAt: string;
    frequency: string;
    dashboardUrl: string;
  }): string {
    const recipientName = escapeHtml(data.recipientName);
    const reportName = escapeHtml(data.reportName);
    const reportType = escapeHtml(data.reportType);
    const frequency = escapeHtml(data.frequency);
    const generatedAt = escapeHtml(data.generatedAt);
    const projectName = data.projectName ? escapeHtml(data.projectName) : '';
    return wrapTemplate(`
      <div class="content">
        <h1>Your Scheduled Report is Ready</h1>
        <p>Hi ${recipientName},</p>
        <p>Your ${frequency} <strong>${reportType}</strong> report "${reportName}" has been generated and is attached to this email.</p>
        ${data.projectName ? `<p><strong>Project:</strong> ${projectName}</p>` : ''}
        <p class="muted"><strong>Generated:</strong> ${generatedAt}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p>The report is attached to this email. You can also view your reports dashboard:</p>
        <p style="text-align: center;">
          <a href="${data.dashboardUrl}" class="button">View Reports Dashboard</a>
        </p>
        <p class="muted" style="margin-top: 20px;">To modify or unsubscribe from this scheduled report, visit your report settings in ProjectFlow.</p>
      </div>
    `);
  },

  /**
   * Mention notification template
   */
  mention(data: {
    recipientName: string;
    mentionerName: string;
    issueKey: string;
    issueTitle: string;
    commentPreview: string;
    issueUrl: string;
  }): string {
    const recipientName = escapeHtml(data.recipientName);
    const mentionerName = escapeHtml(data.mentionerName);
    const issueKey = escapeHtml(data.issueKey);
    const issueTitle = escapeHtml(data.issueTitle);
    const commentPreview = escapeHtml(data.commentPreview);
    return wrapTemplate(`
      <div class="content">
        <h1>You were mentioned in a comment</h1>
        <p>Hi ${recipientName},</p>
        <p><strong>${mentionerName}</strong> mentioned you in a comment on <strong>${issueKey}: ${issueTitle}</strong></p>
        <div style="background: #f5f5f5; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-style: italic;">"${commentPreview}"</p>
        </div>
        <p style="text-align: center;">
          <a href="${data.issueUrl}" class="button">View Comment</a>
        </p>
      </div>
    `);
  },

  /**
   * Onboarding email OTP verification template
   */
  onboardingOtp(data: {
    employeeName: string;
    otp: string;
    expiresIn: string;
  }): string {
    const employeeName = escapeHtml(data.employeeName);
    const otp = escapeHtml(data.otp);
    const expiresIn = escapeHtml(data.expiresIn);
    return wrapTemplate(`
      <div class="content">
        <h1>Verify Your Email</h1>
        <p>Hi ${employeeName},</p>
        <p>To proceed with your onboarding registration, please verify your email address using the OTP below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: #f0f0ff; border: 2px dashed #4F46E5; border-radius: 8px; padding: 20px 40px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4F46E5;">${otp}</span>
          </div>
        </div>
        <p class="muted">This OTP is valid for <strong>${expiresIn}</strong> and can only be used once.</p>
        <p class="muted">If you did not request this, please ignore this email or contact your HR representative.</p>
      </div>
    `);
  },

  /**
   * Offer letter release notification — sent to employee when HR releases the offer letter
   */
  offerLetterRelease(data: {
    employeeName: string;
    designation: string;
    department: string;
    joiningDate: string;
  }): string {
    const employeeName = escapeHtml(data.employeeName);
    const designation = escapeHtml(data.designation);
    const department = escapeHtml(data.department);
    const joiningDate = escapeHtml(data.joiningDate);
    return wrapTemplate(`
      <div class="content">
        <h1>🎉 Your Offer Letter is Ready!</h1>
        <p>Hi ${employeeName},</p>
        <p>We're thrilled to confirm your offer and welcome you to the team! Our HR team has reviewed your details and documents, and your offer has been officially released.</p>
        <div style="background: #f0f7ff; border-left: 4px solid #1268ff; border-radius: 4px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${designation}</p>
          <p style="margin: 0 0 8px 0;"><strong>Department:</strong> ${department}</p>
          <p style="margin: 0;"><strong>Joining Date:</strong> ${joiningDate}</p>
        </div>
        <p>Your formal offer letter will be shared by HR shortly. If you have any questions, please reach out to your HR representative.</p>
        <p>We look forward to seeing you on your first day!</p>
        <p class="muted" style="margin-top: 24px;">If you have not applied for this position or believe this email was sent in error, please contact HR immediately.</p>
      </div>
    `);
  },

  /**
   * Work-email welcome / credentials email sent when HR assigns a work email
   */
  workEmailWelcome(data: {
    employeeName: string;
    workEmail: string;
    tempPassword: string;
    loginUrl: string;
    pmtLoginUrl: string;
  }): string {
    const employeeName = escapeHtml(data.employeeName);
    const workEmail    = escapeHtml(data.workEmail);
    const tempPassword = escapeHtml(data.tempPassword);
    return wrapTemplate(`
      <div class="content">
        <h1>Welcome aboard, ${employeeName}! Your account is ready.</h1>
        <p>Your HR team has set up your work account. You can now log in to both platforms using the credentials below.</p>

        <div style="background:#f4f8ff;border:1px solid #cfe0ff;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 8px;"><strong>Work Email:</strong> <code style="background:#e8f0fe;padding:2px 8px;border-radius:4px;">${workEmail}</code></p>
          <p style="margin:0;"><strong>Temporary Password:</strong> <code style="background:#e8f0fe;padding:2px 8px;border-radius:4px;">${tempPassword}</code></p>
        </div>

        <p style="text-align:center;margin:8px 0;">
          <a href="${data.loginUrl}" class="button" style="background:#1268ff;display:inline-block;margin-right:12px;">Login to HRMS</a>
          <a href="${data.pmtLoginUrl}" class="button" style="background:#0d9f5e;display:inline-block;">Login to Project Tool</a>
        </p>

        <p style="color:#e03d3d;font-weight:600;margin-top:24px;">⚠ Please change your password immediately after your first login.</p>
        <p class="muted">If you did not expect this email, please contact your HR team immediately.</p>
      </div>
    `);
  },

  /**
   * Onboarding self-registration invite template
   */
  onboardingInvite(data: {
    employeeName: string;
    companyName: string;
    joiningDate: string;
    registrationUrl: string;
    expiresIn: string;
    hrName: string;
  }): string {
    const employeeName = escapeHtml(data.employeeName);
    const companyName = escapeHtml(data.companyName);
    const joiningDate = escapeHtml(data.joiningDate);
    const expiresIn = escapeHtml(data.expiresIn);
    const hrName = escapeHtml(data.hrName);
    return wrapTemplate(`
      <div class="content">
        <h1>Welcome to ${companyName}! Complete Your Onboarding</h1>
        <p>Hi ${employeeName},</p>
        <p>Congratulations on joining <strong>${companyName}</strong>! We're excited to have you on board.</p>
        <p>Your joining date is <strong>${joiningDate}</strong>. To prepare for your first day, please complete your onboarding registration by clicking the button below:</p>
        <p style="text-align: center;">
          <a href="${data.registrationUrl}" class="button" style="background: #1268ff;">Complete Your Registration</a>
        </p>
        <p>During registration, you'll be asked to:</p>
        <ul style="margin: 15px 0; padding-left: 20px;">
          <li>Confirm your personal details</li>
          <li>Upload required documents (ID proof, PAN card, educational certificates)</li>
          <li>Provide bank account and emergency contact details</li>
        </ul>
        <p class="muted">This link will expire in <strong>${expiresIn}</strong>. If it expires, please contact your HR representative.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p class="muted" style="font-size: 12px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p class="muted" style="font-size: 12px; word-break: break-all;">${escapeHtml(data.registrationUrl)}</p>
        <p class="muted">For any queries, reach out to ${hrName} or your HR team.</p>
      </div>
    `);
  },
};
