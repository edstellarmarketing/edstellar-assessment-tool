import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface Question {
  question: string;
  type: string;
  options?: string[];
  correct_answer?: string;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questions, topic } = await req.json();
  if (!questions || !Array.isArray(questions)) {
    return NextResponse.json(
      { error: "Questions array is required" },
      { status: 400 }
    );
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("openrouter_api_key, openrouter_model")
    .eq("user_id", user.id)
    .single();

  if (!settings?.openrouter_api_key) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured." },
      { status: 400 }
    );
  }

  const model = settings.openrouter_model || "openai/gpt-4o-mini";

  const questionsForPrompt = questions.map(
    (q: Question, i: number) =>
      `${i + 1}. [${q.type.toUpperCase()}] ${q.question}`
  );

  const prompt = `For the following assessment questions on "${topic}", generate the correct answers.

Questions:
${questionsForPrompt.join("\n")}

Return a JSON array where each object has:
- "question": the original question text
- "type": the question type (mcq, short_answer, long_answer, attachment)
- "options": array of 4 options (ONLY for mcq type, omit for others)
- "correct_answer": the correct answer

For MCQ: provide 4 plausible options and the correct answer (must be one of the options)
For Short Answer: provide a concise 1-2 sentence answer
For Long Answer: provide a detailed 3-5 sentence answer
For Attachment: describe what the expected submission should contain

Return ONLY the JSON array, no other text.`;

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
              content:
                "You are an assessment answer generator. Always respond with valid JSON only, no markdown fences.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      return NextResponse.json(
        { error: "Failed to generate answers. Check your OpenRouter API key." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const answeredQuestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions: answeredQuestions });
  } catch (e) {
    console.error("Generate answers error:", e);
    return NextResponse.json(
      { error: "Failed to generate answers" },
      { status: 500 }
    );
  }
}
