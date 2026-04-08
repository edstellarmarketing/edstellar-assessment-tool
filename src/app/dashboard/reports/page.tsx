"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface DetailedAnswer {
  questionIndex: number;
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  promptScore?: number | null;
  promptFeedback?: string | null;
}

interface FinishedAssessment {
  id: string;
  assessment_name: string;
  topic: string;
  participant_email: string;
  total_questions: number;
  mcq_questions: number;
  score: number;
  answers: DetailedAnswer[];
  started_at: string;
  completed_at: string;
  duration_minutes: number;
  assessment_type?: string;
  prompt_score?: number | null;
  prompt_evaluated?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  attachment: "Attachment",
  prompting: "AI Prompt",
};

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<FinishedAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewReport, setViewReport] = useState<FinishedAssessment | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error: fetchError, status } = await supabase
        .from("finished_assessments")
        .select("*")
        .eq("user_id", session.user.id)
        .order("completed_at", { ascending: false });

      console.log("Reports fetch:", { data, error: fetchError, status });

      if (fetchError) {
        setError("Failed to load reports: " + fetchError.message + " (code: " + fetchError.code + ")");
      } else {
        setReports(data || []);
      }
      setLoading(false);
    };

    load();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeTaken = (start: string, end: string) => {
    if (!start || !end) return "—";
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s}s`;
  };

  const sendResults = async (report: FinishedAssessment) => {
    setSendingId(report.id);
    setSendStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/send-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportId: report.id }),
      });

      const data = await res.json();
      setSendStatus({
        id: report.id,
        success: data.sent,
        message: data.sent ? "Results sent!" : (data.reason || "Failed to send"),
      });
    } catch {
      setSendStatus({ id: report.id, success: false, message: "Network error" });
    } finally {
      setSendingId(null);
    }
  };

  const evaluatePrompts = async (report: FinishedAssessment) => {
    setEvaluatingId(report.id);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/evaluate-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportId: report.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to evaluate prompts");
        setEvaluatingId(null);
        return;
      }

      // Update the report in state
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, answers: data.answers, prompt_score: data.avgScore, prompt_evaluated: true }
            : r
        )
      );

      // Update viewReport if it's open
      if (viewReport?.id === report.id) {
        setViewReport({
          ...viewReport,
          answers: data.answers,
          prompt_score: data.avgScore,
          prompt_evaluated: true,
        });
      }
    } catch {
      setError("Failed to evaluate prompts. Please try again.");
    } finally {
      setEvaluatingId(null);
    }
  };

  const deleteReport = async (id: string) => {
    setDeletingId(id);
    try {
      const { error: delError } = await supabase
        .from("finished_assessments")
        .delete()
        .eq("id", id);

      if (delError) {
        setError("Failed to delete report: " + delError.message);
      } else {
        setReports((prev) => prev.filter((r) => r.id !== id));
        if (viewReport?.id === id) setViewReport(null);
      }
    } catch {
      setError("Failed to delete report. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const getScoreColor = (score: number, total: number) => {
    if (total === 0) return "text-gray-500";
    const pct = (score / total) * 100;
    if (pct >= 80) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getPromptScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const isPromptingAssessment = (report: FinishedAssessment) => {
    return report.assessment_type === "prompting" || report.answers?.some((a) => a.type === "prompting");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading reports...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Assessment Reports</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No reports yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Reports will appear here once participants complete their assessments.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Total Completed</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{reports.length}</p>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Avg MCQ Score</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {reports.filter((r) => r.mcq_questions > 0).length > 0
                  ? Math.round(
                      (reports
                        .filter((r) => r.mcq_questions > 0)
                        .reduce((acc, r) => acc + (r.score / r.mcq_questions) * 100, 0) /
                        reports.filter((r) => r.mcq_questions > 0).length)
                    ) + "%"
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">Unique Participants</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {new Set(reports.map((r) => r.participant_email)).size}
              </p>
            </div>
          </div>

          {/* Reports table */}
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Participant</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Assessment</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Time Taken</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Completed</th>
                  <th className="px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{r.participant_email}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{r.assessment_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-500">{r.total_questions} questions</p>
                          {isPromptingAssessment(r) && (
                            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                              Prompting
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isPromptingAssessment(r) ? (
                        r.prompt_evaluated && r.prompt_score != null ? (
                          <span className={`font-semibold ${getPromptScoreColor(r.prompt_score)}`}>
                            {r.prompt_score}/10
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not evaluated</span>
                        )
                      ) : r.mcq_questions > 0 ? (
                        <span className={`font-semibold ${getScoreColor(r.score, r.mcq_questions)}`}>
                          {r.score}/{r.mcq_questions}
                          <span className="ml-1 text-xs font-normal text-gray-400">
                            ({Math.round((r.score / r.mcq_questions) * 100)}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No MCQs</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {getTimeTaken(r.started_at, r.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(r.completed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/reports/${r.id}`)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          View Report
                        </button>
                        <button
                          onClick={() => setViewReport(r)}
                          className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          View Details
                        </button>
                        {isPromptingAssessment(r) && !r.prompt_evaluated && (
                          <button
                            onClick={() => evaluatePrompts(r)}
                            disabled={evaluatingId === r.id}
                            className="rounded-md bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                          >
                            {evaluatingId === r.id ? "Evaluating..." : "Evaluate Prompts"}
                          </button>
                        )}
                        <button
                          onClick={() => sendResults(r)}
                          disabled={sendingId === r.id}
                          className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {sendingId === r.id ? "Sending..." : "Send Results"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          disabled={deletingId === r.id}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === r.id ? "Deleting..." : "Delete"}
                        </button>
                        {sendStatus?.id === r.id && (
                          <span className={`text-xs ${sendStatus.success ? "text-green-600" : "text-red-600"}`}>
                            {sendStatus.message}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Delete Report</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete this completed assessment report? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteReport(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDeleteId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewReport.assessment_name}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">{viewReport.participant_email}</p>
                  {isPromptingAssessment(viewReport) && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      Prompting Assessment
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewReport(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Score summary */}
            <div className={`mb-5 grid gap-3 ${isPromptingAssessment(viewReport) ? "grid-cols-3" : "grid-cols-3"}`}>
              {isPromptingAssessment(viewReport) ? (
                <div className="rounded-md bg-purple-50 p-3 text-center">
                  <p className="text-xs text-gray-500">Prompt Score</p>
                  <p className={`text-lg font-bold ${viewReport.prompt_score != null ? getPromptScoreColor(viewReport.prompt_score) : "text-gray-400"}`}>
                    {viewReport.prompt_score != null ? `${viewReport.prompt_score}/10` : "Not evaluated"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-gray-50 p-3 text-center">
                  <p className="text-xs text-gray-500">MCQ Score</p>
                  <p className={`text-lg font-bold ${getScoreColor(viewReport.score, viewReport.mcq_questions)}`}>
                    {viewReport.mcq_questions > 0
                      ? `${viewReport.score}/${viewReport.mcq_questions}`
                      : "—"}
                  </p>
                </div>
              )}
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Time Taken</p>
                <p className="text-lg font-bold text-gray-900">
                  {getTimeTaken(viewReport.started_at, viewReport.completed_at)}
                </p>
              </div>
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Total Questions</p>
                <p className="text-lg font-bold text-gray-900">{viewReport.total_questions}</p>
              </div>
            </div>

            {/* Evaluate button for prompting assessments */}
            {isPromptingAssessment(viewReport) && !viewReport.prompt_evaluated && (
              <div className="mb-5 rounded-md border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-900">Prompt evaluation pending</p>
                    <p className="text-xs text-purple-600">Run AI evaluation to score the participant&apos;s prompts and generate feedback.</p>
                  </div>
                  <button
                    onClick={() => evaluatePrompts(viewReport)}
                    disabled={evaluatingId === viewReport.id}
                    className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {evaluatingId === viewReport.id ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Evaluating...
                      </span>
                    ) : (
                      "Evaluate Prompts"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Answers */}
            <div className="max-h-[55vh] space-y-3 overflow-y-auto">
              {viewReport.answers.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-md border p-4 ${
                    a.type === "prompting"
                      ? a.promptScore != null
                        ? a.promptScore >= 7
                          ? "border-green-200 bg-green-50/50"
                          : a.promptScore >= 4
                            ? "border-yellow-200 bg-yellow-50/50"
                            : "border-red-200 bg-red-50/50"
                        : "border-purple-200 bg-purple-50/30"
                      : a.isCorrect === true
                        ? "border-green-200 bg-green-50/50"
                        : a.isCorrect === false
                          ? "border-red-200 bg-red-50/50"
                          : "border-gray-200"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">
                      Question {i + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {TYPE_LABELS[a.type] || a.type}
                      </span>
                      {a.type === "prompting" && a.promptScore != null && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.promptScore >= 7
                            ? "bg-green-100 text-green-700"
                            : a.promptScore >= 4
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}>
                          Score: {a.promptScore}/10
                        </span>
                      )}
                      {a.isCorrect === true && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Correct
                        </span>
                      )}
                      {a.isCorrect === false && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Incorrect
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{a.question}</p>

                  <div className="mt-2 space-y-1.5">
                    <div>
                      <span className="text-xs font-medium text-gray-500">
                        {a.type === "prompting" ? "Participant\u2019s Prompt:" : "Participant\u2019s Answer:"}
                      </span>
                      <p className={`text-sm ${a.userAnswer ? "text-gray-700" : "italic text-gray-400"}`}>
                        {a.userAnswer || "No answer provided"}
                      </p>
                    </div>
                    {a.type === "prompting" && a.promptFeedback && (
                      <div className="mt-2 rounded-md bg-white/80 p-3">
                        <span className="text-xs font-medium text-purple-600">AI Feedback:</span>
                        <p className="mt-1 text-sm text-gray-700">{a.promptFeedback}</p>
                      </div>
                    )}
                    {a.type !== "prompting" && a.correctAnswer && (
                      <div>
                        <span className="text-xs font-medium text-green-600">Correct Answer:</span>
                        <p className="text-sm text-green-700">{a.correctAnswer}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              {sendStatus?.id === viewReport.id && (
                <span className={`text-sm ${sendStatus.success ? "text-green-600" : "text-red-600"}`}>
                  {sendStatus.message}
                </span>
              )}
              {isPromptingAssessment(viewReport) && !viewReport.prompt_evaluated && (
                <button
                  onClick={() => evaluatePrompts(viewReport)}
                  disabled={evaluatingId === viewReport.id}
                  className="rounded-md bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {evaluatingId === viewReport.id ? "Evaluating..." : "Evaluate Prompts"}
                </button>
              )}
              <button
                onClick={() => sendResults(viewReport)}
                disabled={sendingId === viewReport.id}
                className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {sendingId === viewReport.id ? "Sending..." : "Send Results to Participant"}
              </button>
              <button
                onClick={() => setViewReport(null)}
                className="rounded-md bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
