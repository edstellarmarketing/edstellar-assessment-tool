import { getSupabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, reportEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { inviteId, answers } = await req.json();

  if (!inviteId || !answers) {
    return NextResponse.json({ error: "Invite ID and answers are required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: invite, error } = await admin
    .from("invites")
    .select("*, assessments(id, name, topic, total_questions, duration_minutes, questions, user_id)")
    .eq("id", inviteId)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }

  if (invite.status === "completed") {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  const assessment = invite.assessments;
  let correctCount = 0;
  const totalQuestions = assessment.questions.length;
  const mcqCount = assessment.questions.filter(
    (q: { type: string }) => q.type === "mcq"
  ).length;

  const detailedAnswers = assessment.questions.map(
    (q: { question: string; correct_answer?: string; type: string; options?: string[] }, i: number) => {
      const userAnswer = answers[i]?.answer || "";
      let isCorrect = false;

      if (q.type === "mcq" && q.correct_answer) {
        isCorrect = userAnswer === q.correct_answer;
        if (isCorrect) correctCount++;
      }

      return {
        questionIndex: i,
        question: q.question,
        type: q.type,
        userAnswer,
        correctAnswer: q.correct_answer || "",
        isCorrect: q.type === "mcq" ? isCorrect : null,
        promptScore: null,
        promptFeedback: null,
      };
    }
  );

  // Save response
  const { error: saveError } = await admin.from("responses").insert({
    invite_id: inviteId,
    assessment_id: assessment.id,
    answers,
    score: correctCount,
  });

  if (saveError) {
    console.error("Save response error:", saveError);
    return NextResponse.json({ error: "Failed to save response" }, { status: 500 });
  }

  const completedAt = new Date().toISOString();

  // Save to finished_assessments
  const { error: finishError } = await admin.from("finished_assessments").insert({
    user_id: assessment.user_id,
    assessment_id: assessment.id,
    invite_id: inviteId,
    participant_email: invite.email,
    assessment_name: assessment.name,
    topic: assessment.topic,
    total_questions: totalQuestions,
    mcq_questions: mcqCount,
    score: correctCount,
    answers: detailedAnswers,
    started_at: invite.started_at,
    completed_at: completedAt,
    duration_minutes: assessment.duration_minutes,
    assessment_type: assessment.assessment_type || "mcq",
  });

  if (finishError) {
    console.error("Save finished assessment error:", finishError);
  }

  // Mark invite as completed
  await admin
    .from("invites")
    .update({ status: "completed", completed_at: completedAt })
    .eq("id", inviteId);

  // Send report email to participant
  const timeTaken = invite.started_at
    ? `${Math.floor((new Date(completedAt).getTime() - new Date(invite.started_at).getTime()) / 60000)}m`
    : "—";

  sendEmail({
    to: invite.email,
    subject: `Assessment Completed: ${assessment.name}`,
    html: reportEmailHtml(assessment.name, correctCount, totalQuestions, mcqCount, timeTaken, detailedAnswers),
  }).catch((e) => console.error("Report email error:", e));

  return NextResponse.json({
    message: "Assessment submitted successfully",
  });
}
