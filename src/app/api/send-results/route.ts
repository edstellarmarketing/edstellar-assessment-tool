import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail, reportEmailHtml } from "@/lib/email";

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

  const { reportId } = await req.json();
  if (!reportId) {
    return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
  }

  const { data: report } = await supabase
    .from("finished_assessments")
    .select("*")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Calculate time taken
  const diff = Math.floor(
    (new Date(report.completed_at).getTime() - new Date(report.started_at).getTime()) / 1000
  );
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  const timeTaken = `${m}m ${s}s`;

  const emailResult = await sendEmail({
    to: report.participant_email,
    subject: `Your Assessment Results: ${report.assessment_name}`,
    html: reportEmailHtml(
      report.assessment_name,
      report.score,
      report.total_questions,
      report.mcq_questions,
      timeTaken,
      report.answers || []
    ),
  });

  return NextResponse.json({
    sent: emailResult.sent,
    reason: emailResult.sent ? "Results sent successfully" : emailResult.reason,
  });
}
