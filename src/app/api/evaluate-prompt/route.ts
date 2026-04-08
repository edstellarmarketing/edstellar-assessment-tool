import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

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

  // Get settings for OpenRouter
  const { data: settings } = await supabase
    .from("settings")
    .select("openrouter_api_key, openrouter_model")
    .eq("user_id", user.id)
    .single();

  if (!settings?.openrouter_api_key) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  const model = settings.openrouter_model || "openai/gpt-4o-mini";

  // Evaluate each prompting question
  const answers = report.answers || [];
  const promptAnswers = answers.filter(
    (a: { type: string }) => a.type === "prompting"
  );

  if (promptAnswers.length === 0) {
    return NextResponse.json({ error: "No prompting questions found in this assessment" }, { status: 400 });
  }

  const evaluationPrompt = `You are an AI prompt engineering evaluator. Evaluate the following participant prompts for quality, clarity, specificity, and effectiveness.

For each prompt, provide:
1. A score from 0-10 (10 being perfect)
2. Brief feedback explaining the score

Here are the questions and the participant's prompts:

${promptAnswers.map((a: { question: string; userAnswer: string }, i: number) => `
--- Question ${i + 1} ---
Task: ${a.question}
Participant's Prompt: ${a.userAnswer || "(No answer provided)"}
`).join("\n")}

Return a JSON array with this exact format:
[
  {
    "questionIndex": 0,
    "score": 8,
    "feedback": "Clear and specific prompt with good context. Could improve by adding output format constraints."
  }
]

Rules:
- Return ONLY the JSON array, no other text
- Evaluate based on: clarity, specificity, context provided, constraints defined, expected output format
- Score 0 if no answer was provided
- Be fair but rigorous in evaluation`;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.openrouter_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You are an expert AI prompt engineering evaluator. Always respond with valid JSON only, no markdown fences.",
            },
            { role: "user", content: evaluationPrompt },
          ],
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      return NextResponse.json(
        { error: "Failed to evaluate prompts. Check your OpenRouter API key." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI evaluation response" },
        { status: 500 }
      );
    }

    const evaluations = JSON.parse(jsonMatch[0]);

    // Update the answers with prompt scores
    let promptIdx = 0;
    const updatedAnswers = answers.map((a: { type: string; question: string; userAnswer: string; promptScore: number | null; promptFeedback: string | null }) => {
      if (a.type !== "prompting") return a;

      const evaluation = evaluations[promptIdx];
      promptIdx++;

      return {
        ...a,
        promptScore: evaluation?.score ?? null,
        promptFeedback: evaluation?.feedback ?? null,
      };
    });

    // Calculate average prompt score
    const totalPromptScore = evaluations.reduce(
      (acc: number, e: { score: number }) => acc + (e.score || 0),
      0
    );
    const avgPromptScore = Math.round((totalPromptScore / evaluations.length) * 10) / 10;

    // Update the finished_assessments record using admin client to bypass RLS
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from("finished_assessments")
      .update({
        answers: updatedAnswers,
        prompt_score: avgPromptScore,
        prompt_evaluated: true,
      })
      .eq("id", reportId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to save evaluation" }, { status: 500 });
    }

    return NextResponse.json({
      evaluations,
      avgScore: avgPromptScore,
      answers: updatedAnswers,
    });
  } catch (e) {
    console.error("Evaluate prompt error:", e);
    return NextResponse.json(
      { error: "Failed to evaluate prompts" },
      { status: 500 }
    );
  }
}
