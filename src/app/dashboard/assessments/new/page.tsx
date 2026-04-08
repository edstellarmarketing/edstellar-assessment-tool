"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Question {
  question: string;
  type: "mcq" | "short_answer" | "long_answer" | "attachment";
  options?: string[];
  correct_answer?: string;
}

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "attachment", label: "Attachment" },
];

export default function NewAssessmentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [duration, setDuration] = useState(30);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    });
  }, [router]);

  const getAuthHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : "";
  }, []);

  const handleGenerateQuestions = async () => {
    setError("");
    setGenerating(true);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ topic, totalQuestions }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate questions");
        setGenerating(false);
        return;
      }

      setQuestions(data.questions.map((q: Question) => ({ ...q, type: q.type || "mcq" })));
      setStep(3);
    } catch {
      setError("Failed to generate questions. Please try again.");
    }
    setGenerating(false);
  };

  const handleGenerateAnswers = async () => {
    setError("");
    setGenerating(true);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/generate-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ questions, topic }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate answers");
        setGenerating(false);
        return;
      }

      setQuestions(data.questions);
      setStep(4);
    } catch {
      setError("Failed to generate answers. Please try again.");
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");

    const { error: saveError } = await supabase.from("assessments").insert({
      user_id: userId,
      name,
      topic,
      total_questions: totalQuestions,
      duration_minutes: duration,
      questions,
    });

    setSaving(false);

    if (saveError) {
      setError("Failed to save assessment: " + saveError.message);
      return;
    }

    setStep(5);
  };

  const updateQuestionType = (index: number, type: Question["type"]) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, type } : q)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {["Details", "Topic", "Questions", "Answers", "Saved"].map((label, i) => (
            <div key={label} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step > i + 1
                    ? "bg-green-500 text-white"
                    : step === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span className={`ml-2 text-sm ${step === i + 1 ? "font-medium text-gray-900" : "text-gray-500"}`}>
                {label}
              </span>
              {i < 4 && <div className="mx-4 h-px w-8 bg-gray-300 sm:w-16" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-gray-900">Assessment Details</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Assessment Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. JavaScript Fundamentals Quiz"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalQuestions" className="block text-sm font-medium text-gray-700">Total Questions</label>
                <input
                  id="totalQuestions"
                  type="number"
                  min={1}
                  max={50}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                <input
                  id="duration"
                  type="number"
                  min={1}
                  max={300}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="pt-4">
              <button
                onClick={() => {
                  if (!name.trim()) { setError("Please enter an assessment name."); return; }
                  setError("");
                  setStep(2);
                }}
                className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Topic */}
      {step === 2 && (
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-gray-900">What topic do you want to build questions on?</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-gray-700">Topic</label>
              <textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. React hooks, closures, and state management in modern JavaScript applications"
                rows={3}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Be specific for better questions.</p>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="rounded-md bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Back</button>
              <button
                onClick={() => { if (!topic.trim()) { setError("Please enter a topic."); return; } handleGenerateQuestions(); }}
                disabled={generating}
                className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? "Generating Questions..." : "Generate Questions"}
              </button>
            </div>
          </div>
          {generating && (
            <div className="mt-6 flex items-center gap-3 rounded-md bg-blue-50 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-blue-700">AI is generating {totalQuestions} questions on &ldquo;{topic}&rdquo;...</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Review Questions */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-bold text-gray-900">Review & Configure Questions</h2>
            <p className="text-sm text-gray-500">Review the generated questions and choose the answer type for each one.</p>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-400">Question {i + 1}</span>
                  <p className="mt-1 text-sm text-gray-900">{q.question}</p>
                </div>
                <select
                  value={q.type}
                  onChange={(e) => updateQuestionType(i, e.target.value as Question["type"])}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(2)} className="rounded-md bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Back</button>
            <button
              onClick={handleGenerateAnswers}
              disabled={generating}
              className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "Generating Answers..." : "Generate Answers"}
            </button>
          </div>
          {generating && (
            <div className="flex items-center gap-3 rounded-md bg-blue-50 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-sm text-blue-700">AI is generating correct answers for each question...</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Review Answers */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-bold text-gray-900">Review Answers</h2>
            <p className="text-sm text-gray-500">Review the generated answers. Click &ldquo;Save Assessment&rdquo; when you&apos;re satisfied.</p>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">Question {i + 1}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {QUESTION_TYPES.find((t) => t.value === q.type)?.label}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900">{q.question}</p>
              {q.type === "mcq" && q.options && (
                <div className="mt-3 space-y-1.5">
                  {q.options.map((opt, j) => (
                    <div
                      key={j}
                      className={`rounded-md px-3 py-1.5 text-sm ${
                        opt === q.correct_answer ? "bg-green-50 font-medium text-green-700" : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {String.fromCharCode(65 + j)}. {opt}
                      {opt === q.correct_answer && " ✓"}
                    </div>
                  ))}
                </div>
              )}
              {q.type !== "mcq" && q.correct_answer && (
                <div className="mt-3 rounded-md bg-green-50 p-3">
                  <span className="text-xs font-medium text-green-600">Correct Answer:</span>
                  <p className="mt-1 text-sm text-green-700">{q.correct_answer}</p>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep(3)} className="rounded-md bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Back</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Success */}
      {step === 5 && (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Assessment Saved!</h2>
          <p className="mb-6 text-sm text-gray-500">
            &ldquo;{name}&rdquo; with {questions.length} questions has been saved successfully.
          </p>
          <div className="flex justify-center gap-3">
            <a href="/dashboard" className="rounded-md bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Back to Dashboard</a>
            <button
              onClick={() => { setStep(1); setName(""); setTotalQuestions(10); setDuration(30); setTopic(""); setQuestions([]); setError(""); }}
              className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
