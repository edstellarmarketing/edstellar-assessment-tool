import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function sendEmail(to: string, assessmentName: string, inviteLink: string, otp: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log("RESEND_API_KEY not set, skipping email");
    return { sent: false, reason: "Email not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Assessment Tool <onboarding@resend.dev>",
        to: [to],
        subject: `You're invited to take: ${assessmentName}`,
        html: `
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
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      return { sent: false, reason: "Email delivery failed" };
    }

    return { sent: true };
  } catch (e) {
    console.error("Email send error:", e);
    return { sent: false, reason: "Email delivery failed" };
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId, email } = await req.json();
  if (!assessmentId || !email) {
    return NextResponse.json({ error: "Assessment and email are required" }, { status: 400 });
  }

  // Verify the assessment belongs to this user
  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, name")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .single();

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Create invite
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      assessment_id: assessmentId,
      email,
      otp,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Create invite error:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const baseUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/dashboard.*/, "") || "";
  const inviteLink = `${baseUrl}/assessment/${invite.id}`;

  // Send email
  const emailResult = await sendEmail(email, assessment.name, inviteLink, otp);

  return NextResponse.json({
    inviteId: invite.id,
    otp,
    inviteLink,
    assessmentName: assessment.name,
    email,
    emailSent: emailResult.sent,
    emailNote: emailResult.sent ? "Email sent successfully" : emailResult.reason,
  });
}
