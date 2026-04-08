interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface EmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_EMAIL_URL;
  if (!scriptUrl) {
    return { sent: false, reason: "GOOGLE_SCRIPT_EMAIL_URL not set" };
  }

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    const body = await res.text();
    console.log("Google Script response:", res.status, body);

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      // Google Apps Script sometimes redirects — follow it
      if (res.redirected || res.status === 302) {
        return { sent: false, reason: "Google Script redirect — check deployment settings" };
      }
      return { sent: false, reason: `Unexpected response: ${body.slice(0, 200)}` };
    }

    if (data.success) {
      return { sent: true };
    }

    return { sent: false, reason: data.error || "Google Script failed" };
  } catch (e) {
    console.error("Google Script email error:", e);
    return { sent: false, reason: `Google Script error: ${e}` };
  }
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
