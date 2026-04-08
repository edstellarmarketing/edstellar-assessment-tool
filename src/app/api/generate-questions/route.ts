import { createClient } from "@supabase/supabase-js";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, totalQuestions } = await req.json();
  if (!topic || !totalQuestions) {
    return NextResponse.json(
      { error: "Topic and totalQuestions are required" },
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
      { error: "OpenRouter API key not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  const model = settings.openrouter_model || "openai/gpt-4o-mini";

  const prompt = `Generate exactly ${totalQuestions} assessment questions on the topic: "${topic}".

Return a JSON array of objects with this exact format:
[
  {
    "question": "The question text",
    "type": "mcq"
  }
]

Rules:
- Generate exactly ${totalQuestions} questions
- Set all types to "mcq" by default
- Questions should vary in difficulty (easy, medium, hard)
- Questions should cover different aspects of the topic
- Return ONLY the JSON array, no other text`;

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
                "You are an assessment question generator. Always respond with valid JSON only, no markdown fences.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      return NextResponse.json(
        { error: "Failed to generate questions. Check your OpenRouter API key." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from the response (handle markdown fences if present)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });
  } catch (e) {
    console.error("Generate questions error:", e);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
