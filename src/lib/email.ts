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
    // Google Apps Script redirects POST requests (302).
    // We must disable auto-redirect and follow manually to preserve the POST body response.
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
      redirect: "follow",
    });

    const body = await res.text();
    console.log("Google Script response:", res.status, res.url, body.slice(0, 500));

    // Google Apps Script may return HTML on auth issues
    if (body.includes("<!DOCTYPE html>") || body.includes("<HTML>")) {
      console.error("Google Script returned HTML — likely auth/permission issue");
      return { sent: false, reason: "Google Script auth error — redeploy with 'Anyone' access" };
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return { sent: false, reason: `Non-JSON response: ${body.slice(0, 100)}` };
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

interface ReportAnswer {
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
}

export function reportEmailHtml(
  assessmentName: string,
  score: number,
  totalQuestions: number,
  mcqQuestions: number,
  timeTaken: string,
  answers: ReportAnswer[]
): string {
  const answersHtml = answers.map((a, i) => {
    const borderColor = a.isCorrect === true ? "#bbf7d0" : a.isCorrect === false ? "#fecaca" : "#e5e7eb";
    const bgColor = a.isCorrect === true ? "#f0fdf4" : a.isCorrect === false ? "#fef2f2" : "#ffffff";
    const statusLabel = a.isCorrect === true
      ? '<span style="color: #15803d; font-weight: 600; font-size: 12px;">Correct</span>'
      : a.isCorrect === false
        ? '<span style="color: #dc2626; font-weight: 600; font-size: 12px;">Incorrect</span>'
        : '';

    return `
      <div style="border: 1px solid ${borderColor}; background: ${bgColor}; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #9ca3af; font-size: 12px; font-weight: 500;">Question ${i + 1}</span>
          ${statusLabel}
        </div>
        <p style="margin: 0 0 10px 0; color: #111827; font-size: 14px; font-weight: 500;">${a.question}</p>
        <div style="margin-bottom: 4px;">
          <span style="color: #6b7280; font-size: 12px; font-weight: 500;">Your Answer:</span>
          <p style="margin: 2px 0 0 0; color: ${a.userAnswer ? '#374151' : '#9ca3af'}; font-size: 13px; ${!a.userAnswer ? 'font-style: italic;' : ''}">${a.userAnswer || 'No answer provided'}</p>
        </div>
        ${a.correctAnswer ? `
        <div>
          <span style="color: #15803d; font-size: 12px; font-weight: 500;">Correct Answer:</span>
          <p style="margin: 2px 0 0 0; color: #15803d; font-size: 13px;">${a.correctAnswer}</p>
        </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
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

      <h3 style="color: #111827; margin: 24px 0 12px 0; font-size: 16px;">Detailed Results</h3>
      ${answersHtml}

      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
        Thank you for completing the assessment.
      </p>
    </div>
  `;
}
