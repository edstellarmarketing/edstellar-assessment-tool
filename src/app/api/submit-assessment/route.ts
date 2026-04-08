import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { inviteId, answers } = await req.json();

  if (!inviteId || !answers) {
    return NextResponse.json({ error: "Invite ID and answers are required" }, { status: 400 });
  }

  // Get invite
  const { data: invite, error } = await supabaseAdmin
    .from("invites")
    .select("*, assessments(id, questions)")
    .eq("id", inviteId)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }

  if (invite.status === "completed") {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  // Calculate score
  const assessment = invite.assessments;
  let correctCount = 0;
  const totalQuestions = assessment.questions.length;

  assessment.questions.forEach(
    (q: { correct_answer?: string; type: string }, i: number) => {
      const userAnswer = answers[i]?.answer || "";
      if (q.type === "mcq" && q.correct_answer) {
        if (userAnswer === q.correct_answer) correctCount++;
      }
      // For non-MCQ, manual grading would be needed
    }
  );

  // Save response
  const { error: saveError } = await supabaseAdmin.from("responses").insert({
    invite_id: inviteId,
    assessment_id: assessment.id,
    answers,
    score: correctCount,
  });

  if (saveError) {
    console.error("Save response error:", saveError);
    return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
  }

  // Mark invite as completed
  await supabaseAdmin
    .from("invites")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", inviteId);

  return NextResponse.json({
    message: "Assessment submitted successfully",
    score: correctCount,
    total: totalQuestions,
  });
}
