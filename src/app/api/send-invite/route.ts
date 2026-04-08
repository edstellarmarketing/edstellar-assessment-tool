import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, inviteEmailHtml } from "@/lib/email";

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

  const { data: assessment } = await supabase
    .from("assessments")
    .select("id, name")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .single();

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({ assessment_id: assessmentId, email, otp, status: "pending" })
    .select("id")
    .single();

  if (error) {
    console.error("Create invite error:", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const baseUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/dashboard.*/, "") || "";
  const inviteLink = `${baseUrl}/assessment/${invite.id}`;

  const emailResult = await sendEmail({
    to: email,
    subject: `You're invited to take: ${assessment.name}`,
    html: inviteEmailHtml(assessment.name, inviteLink, otp),
  });

  return NextResponse.json({
    inviteId: invite.id,
    otp,
    inviteLink,
    assessmentName: assessment.name,
    email,
    emailSent: emailResult.sent,
    emailNote: emailResult.sent
      ? "Email sent successfully"
      : emailResult.reason,
  });
}
