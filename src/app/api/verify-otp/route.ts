import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { inviteId, otp } = await req.json();

  if (!inviteId || !otp) {
    return NextResponse.json({ error: "Invite ID and OTP are required" }, { status: 400 });
  }

  const { data: invite, error } = await supabaseAdmin
    .from("invites")
    .select("*, assessments(id, name, topic, total_questions, duration_minutes, questions)")
    .eq("id", inviteId)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  if (invite.status === "completed") {
    return NextResponse.json({ error: "This assessment has already been completed" }, { status: 400 });
  }

  if (invite.status === "expired") {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  if (invite.otp !== otp) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
  }

  // Check if invite has expired (7 days)
  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin
      .from("invites")
      .update({ status: "expired" })
      .eq("id", inviteId);
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  // Mark as started if pending
  if (invite.status === "pending") {
    await supabaseAdmin
      .from("invites")
      .update({ status: "started", started_at: new Date().toISOString() })
      .eq("id", inviteId);
  }

  // Return assessment data (without correct answers)
  const assessment = invite.assessments;
  const questionsWithoutAnswers = assessment.questions.map(
    (q: { question: string; type: string; options?: string[] }) => ({
      question: q.question,
      type: q.type,
      options: q.options || undefined,
    })
  );

  return NextResponse.json({
    assessment: {
      id: assessment.id,
      name: assessment.name,
      topic: assessment.topic,
      total_questions: assessment.total_questions,
      duration_minutes: assessment.duration_minutes,
      questions: questionsWithoutAnswers,
    },
    email: invite.email,
    startedAt: invite.started_at || new Date().toISOString(),
  });
}
