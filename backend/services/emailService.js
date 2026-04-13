/**
 * Email Service
 * Sends transactional emails via Nodemailer (SMTP/Gmail)
 * With graceful fallback (logs to console if SMTP not configured)
 */
const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // If email not configured, use Ethereal test account stub
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
    return null; // Will log emails to console instead
  }

  return nodemailer.createTransporter({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const transporter = createTransporter();

/**
 * Send email (with console fallback)
 */
async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    console.log(`📧 [Email Stub] To: ${to} | Subject: ${subject}`);
    return { success: true, stub: true };
  }

  const info = await transporter.sendMail({
    from:    process.env.EMAIL_FROM || '"Internship Portal" <noreply@portal.com>',
    to,
    subject,
    html
  });

  console.log(`📧 Email sent: ${info.messageId}`);
  return { success: true, messageId: info.messageId };
}

// ─── Application Confirmation ─────────────────────────────────
async function sendApplicationConfirmation(toEmail, studentName, internshipTitle) {
  return sendEmail({
    to: toEmail,
    subject: `✅ Application Submitted — ${internshipTitle}`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px;">
      <div style="background: #0a2540; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Smart Internship Portal</h1>
      </div>
      <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #0a2540;">Application Received! 🎉</h2>
        <p style="color: #555;">Hi <strong>${studentName}</strong>,</p>
        <p style="color: #555;">Your application for <strong>${internshipTitle}</strong> has been successfully submitted.</p>
        <div style="background: #f0f7ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #2563eb;"><strong>What's next?</strong></p>
          <p style="margin: 5px 0 0; color: #555;">The company will review your application and update its status. You'll receive an email notification when there's an update.</p>
        </div>
        <p style="color: #555;">You can track your application status in your <a href="${process.env.FRONTEND_URL}/student/applications.html" style="color: #2563eb;">student dashboard</a>.</p>
        <p style="color: #aaa; font-size: 12px; margin-top: 30px;">Smart Internship Portal — Connecting students with opportunities</p>
      </div>
    </div>`
  });
}

// ─── Status Update ────────────────────────────────────────────
async function sendStatusUpdate(toEmail, studentName, internshipTitle, newStatus) {
  const statusConfig = {
    shortlisted: { emoji: '⭐', color: '#f59e0b', label: 'Shortlisted', message: "Congratulations! You've been shortlisted. Prepare for the next round!" },
    rejected:    { emoji: '❌', color: '#ef4444', label: 'Not Selected', message: "We're sorry to inform you that your application was not selected this time. Keep applying!" },
    hired:       { emoji: '🎊', color: '#10b981', label: 'Hired!',       message: "Congratulations! You've been selected for this internship! Check your email for further instructions." },
    applied:     { emoji: '📝', color: '#6366f1', label: 'Under Review', message: "Your application status has been updated to Under Review." }
  };
  const config = statusConfig[newStatus] || statusConfig.applied;

  return sendEmail({
    to: toEmail,
    subject: `${config.emoji} Application Update — ${internshipTitle}`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0a2540; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Smart Internship Portal</h1>
      </div>
      <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: ${config.color};">${config.emoji} Application ${config.label}</h2>
        <p>Hi <strong>${studentName}</strong>,</p>
        <p>Your application for <strong>${internshipTitle}</strong> has been updated.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 40px;">${config.emoji}</span>
          <h3 style="color: ${config.color}; margin: 10px 0;">${config.label}</h3>
          <p style="color: #555;">${config.message}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/student/applications.html"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">
          View Dashboard
        </a>
      </div>
    </div>`
  });
}

// ─── Welcome Email ────────────────────────────────────────────
async function sendWelcomeEmail(toEmail, name, role) {
  return sendEmail({
    to: toEmail,
    subject: `Welcome to Smart Internship Portal! 🚀`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0a2540; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0;">Smart Internship Portal</h1>
      </div>
      <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2>Welcome, ${name}! 🎓</h2>
        <p>Your ${role} account has been created successfully.</p>
        ${role === 'student'
          ? '<p>Start exploring internships, build your profile, and get AI-powered career guidance!</p>'
          : '<p>Start posting internships and discover top talent from leading colleges!</p>'
        }
        <a href="${process.env.FRONTEND_URL}"
           style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Get Started →
        </a>
      </div>
    </div>`
  });
}

module.exports = { sendApplicationConfirmation, sendStatusUpdate, sendWelcomeEmail, sendEmail };
