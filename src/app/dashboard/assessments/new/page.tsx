"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Question {
  question: string;
  type: "mcq" | "short_answer" | "long_answer" | "attachment" | "prompting";
  options?: string[];
  correct_answer?: string;
}

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "attachment", label: "Attachment" },
];

type AssessmentType = "mcq" | "prompting" | null;

export default function NewAssessmentPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [assessmentType, setAssessmentType] = useState<AssessmentType>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [duration, setDuration] = useState(30);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  // Prompting assessment state
  const [promptQuestions, setPromptQuestions] = useState<{ question: string }[]>([{ question: "" }]);

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

  const handleSavePrompting = async () => {
    if (!userId) return;
    const validQuestions = promptQuestions.filter((q) => q.question.trim());
    if (validQuestions.length === 0) {
      setError("Please add at least one question.");
      return;
    }
    setSaving(true);
    setError("");

    const questionsData: Question[] = validQuestions.map((q) => ({
      question: q.question.trim(),
      type: "prompting" as const,
    }));

    const { error: saveError } = await supabase.from("assessments").insert({
      user_id: userId,
      name,
      topic: "AI Prompting Assessment",
      total_questions: validQuestions.length,
      duration_minutes: duration,
      questions: questionsData,
      assessment_type: "prompting",
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

  const addPromptQuestion = () => {
    setPromptQuestions((prev) => [...prev, { question: "" }]);
  };

  const updatePromptQuestion = (index: number, value: string) => {
    setPromptQuestions((prev) => prev.map((q, i) => (i === index ? { question: value } : q)));
  };

  const removePromptQuestion = (index: number) => {
    setPromptQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const resetAll = () => {
    setAssessmentType(null);
    setStep(1);
    setName("");
    setTotalQuestions(10);
    setDuration(30);
    setTopic("");
    setQuestions([]);
    setPromptQuestions([{ question: "" }]);
    setError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Assessment type selection
  if (!assessmentType) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* MCQ Card */}
          <button
            onClick={() => setAssessmentType("mcq")}
            className="group rounded-xl border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-blue-500 hover:shadow-md"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">MCQ Assessment</h3>
            <p className="text-sm text-gray-500">
              Create a traditional assessment with multiple choice, short answer, long answer, and attachment questions. AI generates questions and answers based on your topic.
            </p>
          </button>

          {/* Prompting Assessment Card */}
          <button
            onClick={() => setAssessmentType("prompting")}
            className="group rounded-xl border-2 border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-purple-500 hover:shadow-md"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">AI Prompting Assessment</h3>
            <p className="text-sm text-gray-500">
              Create an assessment where participants write AI prompts. You define the questions, participants submit their prompts, and AI evaluates the accuracy of their responses.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ─── PROMPTING ASSESSMENT FLOW ───
  if (assessmentType === "prompting") {
    return (
      <div className="mx-auto max-w-4xl">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {["Details", "Questions", "Saved"].map((label, i) => (
              <div key={label} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    step > i + 1
                      ? "bg-green-500 text-white"
                      : step === i + 1
                        ? "bg-purple-600 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step > i + 1 ? "✓" : i + 1}
                </div>
                <span className={`ml-2 text-sm ${step === i + 1 ? "font-medium text-gray-900" : "text-gray-500"}`}>
                  {label}
                </span>
                {i < 2 && <div className="mx-4 h-px w-8 bg-gray-300 sm:w-16" />}
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
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setAssessmentType(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <h2 className="text-xl font-bold text-gray-900">AI Prompting Assessment Details</h2>
            </div>
            <div className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Assessment Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AI Prompt Engineering Challenge"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                  className="mt-1 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="pt-4">
                <button
                  onClick={() => {
                    if (!name.trim()) { setError("Please enter an assessment name."); return; }
                    setError("");
                    setStep(2);
                  }}
                  className="rounded-md bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Enter Questions */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-xl font-bold text-gray-900">Define Prompting Questions</h2>
              <p className="text-sm text-gray-500">
                Enter the questions that participants will need to write AI prompts for. Each question should describe a task or goal that the participant must craft an effective prompt to achieve.
              </p>
            </div>

            {promptQuestions.map((q, i) => (
              <div key={i} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Question {i + 1}</span>
                  {promptQuestions.length > 1 && (
                    <button
                      onClick={() => removePromptQuestion(i)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
                <textarea
                  value={q.question}
                  onChange={(e) => updatePromptQuestion(i, e.target.value)}
                  placeholder="e.g. Write a prompt that generates a Python function to sort a list of dictionaries by a specific key..."
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            ))}

            <button
              onClick={addPromptQuestion}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white py-4 text-sm font-medium text-gray-500 hover:border-purple-400 hover:text-purple-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Another Question
            </button>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="rounded-md bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Back</button>
              <button
                onClick={handleSavePrompting}
                disabled={saving}
                className="rounded-md bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Assessment"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 5 && (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Prompting Assessment Saved!</h2>
            <p className="mb-6 text-sm text-gray-500">
              &ldquo;{name}&rdquo; with {promptQuestions.filter((q) => q.question.trim()).length} prompting question(s) has been saved successfully. You can now send it to participants via the Invite page.
            </p>
            <div className="flex justify-center gap-3">
              <a href="/dashboard" className="rounded-md bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Back to Dashboard</a>
              <a href="/dashboard/invite" className="rounded-md bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700">Invite Participants</a>
              <button onClick={resetAll} className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Create Another</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MCQ ASSESSMENT FLOW (original) ───
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
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setAssessmentType(null)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">Assessment Details</h2>
          </div>
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
              onClick={resetAll}
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
