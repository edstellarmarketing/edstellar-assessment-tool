"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface DetailedAnswer {
  questionIndex: number;
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
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
}

const TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  attachment: "Attachment",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<FinishedAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewReport, setViewReport] = useState<FinishedAssessment | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);

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

  const getScoreColor = (score: number, total: number) => {
    if (total === 0) return "text-gray-500";
    const pct = (score / total) * 100;
    if (pct >= 80) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
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
                  <th className="px-4 py-3 font-medium text-gray-600">MCQ Score</th>
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
                        <p className="text-xs text-gray-500">{r.total_questions} questions</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.mcq_questions > 0 ? (
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
                          onClick={() => setViewReport(r)}
                          className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => sendResults(r)}
                          disabled={sendingId === r.id}
                          className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {sendingId === r.id ? "Sending..." : "Send Results"}
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

      {/* Detail Modal */}
      {viewReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewReport.assessment_name}</h3>
                <p className="text-sm text-gray-500">{viewReport.participant_email}</p>
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
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-md bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">MCQ Score</p>
                <p className={`text-lg font-bold ${getScoreColor(viewReport.score, viewReport.mcq_questions)}`}>
                  {viewReport.mcq_questions > 0
                    ? `${viewReport.score}/${viewReport.mcq_questions}`
                    : "—"}
                </p>
              </div>
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

            {/* Answers */}
            <div className="max-h-[55vh] space-y-3 overflow-y-auto">
              {viewReport.answers.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-md border p-4 ${
                    a.isCorrect === true
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
                      <span className="text-xs font-medium text-gray-500">Participant&apos;s Answer:</span>
                      <p className={`text-sm ${a.userAnswer ? "text-gray-700" : "italic text-gray-400"}`}>
                        {a.userAnswer || "No answer provided"}
                      </p>
                    </div>
                    {a.correctAnswer && (
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
