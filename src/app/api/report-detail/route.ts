import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reportId = req.nextUrl.searchParams.get("id");
  if (!reportId) {
    return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
  }

  // Fetch the requested report
  const { data: report, error } = await supabase
    .from("finished_assessments")
    .select("*")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();

  if (error || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Fetch all participants from the same assessment for the sidebar
  const { data: siblings } = await supabase
    .from("finished_assessments")
    .select("id, participant_email, score, mcq_questions, total_questions, assessment_type, prompt_score, prompt_evaluated")
    .eq("assessment_id", report.assessment_id)
    .eq("user_id", user.id)
    .order("score", { ascending: false });

  return NextResponse.json({ report, siblings: siblings || [] });
}
