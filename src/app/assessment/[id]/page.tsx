"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

interface Question {
  question: string;
  type: string;
  options?: string[];
}

interface Assessment {
  id: string;
  name: string;
  topic: string;
  total_questions: number;
  duration_minutes: number;
  questions: Question[];
}

interface Answer {
  questionIndex: number;
  answer: string;
}

export default function AssessmentPage() {
  const params = useParams();
  const inviteId = params.id as string;

  const [step, setStep] = useState<"otp" | "assessment" | "completed" | "error">("otp");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  const submitAssessment = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    try {
      const res = await fetch("/api/submit-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, answers }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        setStep("error");
        setSubmitting(false);
        return;
      }

      setResult({ score: data.score, total: data.total });
      setStep("completed");
    } catch {
      setError("Failed to submit assessment");
      setStep("error");
    }
    setSubmitting(false);
  }, [inviteId, answers]);

  // Timer
  useEffect(() => {
    if (step !== "assessment" || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          submitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, timeLeft, submitAssessment]);

  const handleVerifyOtp = async () => {
    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        setVerifying(false);
        return;
      }

      setAssessment(data.assessment);
      setAnswers(
        data.assessment.questions.map((_: Question, i: number) => ({
          questionIndex: i,
          answer: "",
        }))
      );

      // Calculate remaining time
      const startedAt = new Date(data.startedAt).getTime();
      const durationMs = data.assessment.duration_minutes * 60 * 1000;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));

      if (remaining <= 0) {
        setError("Time has expired for this assessment");
        setStep("error");
      } else {
        setTimeLeft(remaining);
        setStep("assessment");
      }
    } catch {
      setError("Failed to verify OTP");
    }
    setVerifying(false);
  };

  const updateAnswer = (index: number, answer: string) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === index ? { ...a, answer } : a))
    );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // OTP Entry
  if (step === "otp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Enter OTP</h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter the 6-digit OTP to access your assessment
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="w-full rounded-md border border-gray-300 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-gray-900 placeholder-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && otp.length === 6) handleVerifyOtp();
            }}
          />

          <button
            onClick={handleVerifyOtp}
            disabled={verifying || otp.length !== 6}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Start Assessment"}
          </button>
        </div>
      </div>
    );
  }

  // Assessment
  if (step === "assessment" && assessment) {
    const isUrgent = timeLeft < 60;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky header with timer */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
            <div>
              <h1 className="text-base font-semibold text-gray-900">{assessment.name}</h1>
              <p className="text-xs text-gray-500">{assessment.total_questions} questions</p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`rounded-lg px-4 py-2 text-lg font-mono font-bold ${
                  isUrgent
                    ? "animate-pulse bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {formatTime(timeLeft)}
              </div>
              <button
                onClick={submitAssessment}
                disabled={submitting}
                className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-6">
            {assessment.questions.map((q, i) => (
              <div key={i} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">
                    Question {i + 1} of {assessment.total_questions}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {q.type === "mcq"
                      ? "Multiple Choice"
                      : q.type === "short_answer"
                        ? "Short Answer"
                        : q.type === "long_answer"
                          ? "Long Answer"
                          : "Attachment"}
                  </span>
                </div>
                <p className="mb-4 text-sm font-medium text-gray-900">{q.question}</p>

                {/* MCQ */}
                {q.type === "mcq" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => updateAnswer(i, opt)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                          answers[i]?.answer === opt
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                            answers[i]?.answer === opt
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {String.fromCharCode(65 + j)}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Short Answer */}
                {q.type === "short_answer" && (
                  <input
                    type="text"
                    value={answers[i]?.answer || ""}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}

                {/* Long Answer */}
                {q.type === "long_answer" && (
                  <textarea
                    value={answers[i]?.answer || ""}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                    placeholder="Type your detailed answer..."
                    rows={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}

                {/* Attachment */}
                {q.type === "attachment" && (
                  <div>
                    <textarea
                      value={answers[i]?.answer || ""}
                      onChange={(e) => updateAnswer(i, e.target.value)}
                      placeholder="Describe your answer or paste a link to your file..."
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={submitAssessment}
              disabled={submitting}
              className="rounded-md bg-green-600 px-8 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Assessment"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Completed
  if (step === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Assessment Completed!</h1>
          <p className="text-sm text-gray-500">
            Your responses have been submitted successfully.
          </p>
          {result && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">MCQ Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {result.score} / {result.total}
              </p>
            </div>
          )}
          <p className="mt-6 text-xs text-gray-400">
            You can close this page now. This link is no longer active.
          </p>
        </div>
      </div>
    );
  }

  // Error
  if (step === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-3xl">✕</span>
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Unable to Access</h1>
          <p className="text-sm text-gray-500">{error || "This assessment link is no longer valid."}</p>
        </div>
      </div>
    );
  }

  return null;
}
