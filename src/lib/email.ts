interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface EmailResult {
  sent: boolean;
  provider?: string;
  reason?: string;
}

async function sendViaResend(options: EmailOptions): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Assessment Tool <onboarding@resend.dev>",
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    const body = await res.text();

    if (!res.ok) {
      console.error("Resend error response:", res.status, body);
      return { sent: false, reason: `Resend: ${body}` };
    }

    console.log("Resend success:", body);
    return { sent: true, provider: "Resend" };
  } catch (e) {
    console.error("Resend exception:", e);
    return { sent: false, reason: `Resend exception: ${e}` };
  }
}

async function sendViaBrevo(options: EmailOptions): Promise<EmailResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { sent: false, reason: "BREVO_API_KEY not set" };

  // Brevo requires a verified sender email
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) return { sent: false, reason: "BREVO_SENDER_EMAIL not set" };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Assessment Tool", email: senderEmail },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
      }),
    });

    const body = await res.text();

    if (!res.ok) {
      console.error("Brevo error response:", res.status, body);
      return { sent: false, reason: `Brevo: ${body}` };
    }

    console.log("Brevo success:", body);
    return { sent: true, provider: "Brevo" };
  } catch (e) {
    console.error("Brevo exception:", e);
    return { sent: false, reason: `Brevo exception: ${e}` };
  }
}

// Try Resend first, fallback to Brevo
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const providers = [sendViaResend, sendViaBrevo];
  const errors: string[] = [];

  for (const provider of providers) {
    const result = await provider(options);
    if (result.sent) return result;
    if (result.reason) errors.push(result.reason);
  }

  return { sent: false, reason: errors.join(" | ") };
}

// Pre-built email templates

export function inviteEmailHtml(assessmentName: string, inviteLink: string, otp: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111827;">Assessment Invitation</h2>
      <p style="color: #4b5563;">You've been invited to take the following assessment:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600; color: #111827;">${assessmentName}</p>
      </div>
      <p style="color: #4b5563;">Click the link below to start:</p>
      <a href="${inviteLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 8px 0;">
        Start Assessment
      </a>
      <p style="color: #4b5563; margin-top: 16px;">Your OTP code:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 8px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${otp}</span>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        This invite expires in 7 days. Do not share this OTP with anyone.
      </p>
    </div>
  `;
}

export function reportEmailHtml(
  assessmentName: string,
  score: number,
  totalQuestions: number,
  mcqQuestions: number,
  timeTaken: string
): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111827;">Assessment Report</h2>
      <p style="color: #4b5563;">You have successfully completed the following assessment:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; font-weight: 600; color: #111827;">${assessmentName}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total Questions</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right; font-size: 14px;">${totalQuestions}</td>
        </tr>
        ${mcqQuestions > 0 ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">MCQ Score</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right; font-size: 14px;">${score} / ${mcqQuestions} (${Math.round((score / mcqQuestions) * 100)}%)</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time Taken</td>
          <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right; font-size: 14px;">${timeTaken}</td>
        </tr>
      </table>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Thank you for completing the assessment. Your detailed results have been shared with the assessment administrator.
      </p>
    </div>
  `;
}
