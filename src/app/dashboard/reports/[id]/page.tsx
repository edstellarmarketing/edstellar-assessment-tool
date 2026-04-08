"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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

interface Report {
  id: string;
  assessment_id: string;
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

interface Sibling {
  id: string;
  participant_email: string;
  score: number;
  mcq_questions: number;
  total_questions: number;
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

function getScorePct(report: Report): number {
  if (report.assessment_type === "prompting") {
    return report.prompt_score != null ? report.prompt_score * 10 : 0;
  }
  if (report.mcq_questions > 0) {
    return Math.round((report.score / report.mcq_questions) * 100);
  }
  return 0;
}

function getSiblingScore(s: Sibling): number {
  if (s.assessment_type === "prompting") {
    return s.prompt_score != null ? Math.round(s.prompt_score * 10) : 0;
  }
  if (s.mcq_questions > 0) {
    return Math.round((s.score / s.mcq_questions) * 100);
  }
  return 0;
}

function getPerformanceLabel(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "EXCEEDS EXPECTATIONS", color: "text-green-700 bg-green-50 border-green-200" };
  if (pct >= 60) return { label: "MEETS EXPECTATIONS", color: "text-blue-700 bg-blue-50 border-blue-200" };
  if (pct >= 40) return { label: "BELOW EXPECTATIONS", color: "text-yellow-700 bg-yellow-50 border-yellow-200" };
  return { label: "NEEDS IMPROVEMENT", color: "text-red-700 bg-red-50 border-red-200" };
}

function getScoreBarColor(pct: number): string {
  if (pct >= 80) return "bg-green-600";
  if (pct >= 60) return "bg-blue-600";
  if (pct >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getInitials(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function IndividualReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "EXCEEDS" | "MEETS" | "BELOW">("ALL");
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [sendingResults, setSendingResults] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fetchReport = useCallback(async (id: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/report-detail?id=${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      setError("Failed to load report");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setReport(data.report);
    setSiblings(data.siblings);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport(reportId);
  }, [reportId, fetchReport]);

  const navigateToReport = (id: string) => {
    setLoading(true);
    setExpandedQuestion(null);
    setSendStatus(null);
    router.push(`/dashboard/reports/${id}`);
  };

  const evaluatePrompts = async () => {
    if (!report) return;
    setEvaluatingId(report.id);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        return;
      }

      setReport((prev) =>
        prev
          ? { ...prev, answers: data.answers, prompt_score: data.avgScore, prompt_evaluated: true }
          : prev
      );
    } catch {
      setError("Failed to evaluate prompts. Please try again.");
    } finally {
      setEvaluatingId(null);
    }
  };

  const sendResults = async () => {
    if (!report) return;
    setSendingResults(true);
    setSendStatus(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        success: data.sent,
        message: data.sent ? "Results sent!" : data.reason || "Failed to send",
      });
    } catch {
      setSendStatus({ success: false, message: "Network error" });
    } finally {
      setSendingResults(false);
    }
  };

  // Filter and search siblings
  const filteredSiblings = siblings.filter((s) => {
    const email = s.participant_email.toLowerCase();
    if (searchQuery && !email.includes(searchQuery.toLowerCase())) return false;

    const pct = getSiblingScore(s);
    if (filterTab === "EXCEEDS" && pct < 80) return false;
    if (filterTab === "MEETS" && (pct < 60 || pct >= 80)) return false;
    if (filterTab === "BELOW" && pct >= 60) return false;

    return true;
  });

  const filterCounts = {
    ALL: siblings.length,
    EXCEEDS: siblings.filter((s) => getSiblingScore(s) >= 80).length,
    MEETS: siblings.filter((s) => getSiblingScore(s) >= 60 && getSiblingScore(s) < 80).length,
    BELOW: siblings.filter((s) => getSiblingScore(s) < 60).length,
  };

  // Navigate between candidates
  const currentIndex = siblings.findIndex((s) => s.id === reportId);
  const prevCandidate = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextCandidate = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-4 text-red-600">{error}</p>
        <button
          onClick={() => router.push("/dashboard/reports")}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  if (!report) return null;

  const scorePct = getScorePct(report);
  const performance = getPerformanceLabel(scorePct);
  const isPrompting = report.assessment_type === "prompting";

  // Compute question-type breakdown
  const mcqAnswers = report.answers.filter((a) => a.type === "mcq");
  const promptAnswers = report.answers.filter((a) => a.type === "prompting");
  const mcqCorrect = mcqAnswers.filter((a) => a.isCorrect).length;

  // Compute rank
  const sortedScores = [...siblings].sort((a, b) => getSiblingScore(b) - getSiblingScore(a));
  const rank = sortedScores.findIndex((s) => s.id === report.id) + 1;

  // Time formatting
  const formatDuration = (start: string, end: string) => {
    if (!start || !end) return "--";
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Avg cohort score
  const avgCohortScore =
    siblings.length > 0
      ? Math.round(siblings.reduce((acc, s) => acc + getSiblingScore(s), 0) / siblings.length)
      : 0;

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar - Participant List */}
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Assessment Info */}
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">{report.assessment_name}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {siblings.length} participant{siblings.length !== 1 ? "s" : ""} submitted
          </p>
        </div>

        {/* Search */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 text-xs">
          {(["ALL", "EXCEEDS", "MEETS", "BELOW"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`flex-1 py-2.5 text-center font-medium transition-colors ${
                filterTab === tab
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div>{tab}</div>
              <div className="text-[10px]">{filterCounts[tab]}</div>
            </button>
          ))}
        </div>

        {/* Participant List */}
        <div className="flex-1 overflow-y-auto">
          {filteredSiblings.map((s) => {
            const sPct = getSiblingScore(s);
            const isActive = s.id === reportId;
            return (
              <button
                key={s.id}
                onClick={() => navigateToReport(s.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "border-l-3 border-l-blue-600 bg-blue-50"
                    : "border-l-3 border-l-transparent hover:bg-gray-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isActive ? "text-blue-900" : "text-gray-900"}`}>
                    {s.participant_email.split("@")[0]}
                  </p>
                  <p className="truncate text-xs text-gray-400">{s.participant_email}</p>
                </div>
                <span
                  className={`ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                    sPct >= 80
                      ? "bg-green-100 text-green-700"
                      : sPct >= 60
                        ? "bg-blue-100 text-blue-700"
                        : sPct >= 40
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                  }`}
                >
                  {sPct}
                </span>
              </button>
            );
          })}
          {filteredSiblings.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-gray-400">No participants match</p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Breadcrumb */}
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <nav className="flex items-center gap-2 text-xs text-gray-500">
            <button onClick={() => router.push("/dashboard/reports")} className="hover:text-blue-600">
              Reports
            </button>
            <span>/</span>
            <span className="text-gray-400">{report.assessment_name}</span>
            <span>/</span>
            <span className="font-medium text-gray-700">{report.participant_email}</span>
          </nav>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Candidate Header */}
          <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Profile */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-bold text-white">
                  {getInitials(report.participant_email)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {report.participant_email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </h2>
                  <p className="text-xs text-gray-500 truncate">{report.participant_email}</p>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-400 sm:grid-cols-2">
                    <span className="truncate">
                      <span className="font-medium text-gray-500">ASSESSMENT</span>{" "}
                      {report.assessment_name}
                    </span>
                    <span className="truncate">
                      <span className="font-medium text-gray-500">TOPIC</span> {report.topic}
                    </span>
                    <span>
                      <span className="font-medium text-gray-500">SUBMITTED</span>{" "}
                      {formatDate(report.completed_at)}
                    </span>
                    <span>
                      <span className="font-medium text-gray-500">DURATION</span>{" "}
                      {formatDuration(report.started_at, report.completed_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Composite Score */}
              <div className="flex-shrink-0 lg:text-right">
                <p className="text-[10px] font-medium tracking-wider text-gray-400">COMPOSITE SCORE</p>
                <p className="text-3xl font-bold text-gray-900">
                  {scorePct}
                  <span className="text-base font-normal text-gray-400">/100</span>
                </p>
                <span
                  className={`mt-1 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${performance.color}`}
                >
                  {performance.label}
                </span>
                {siblings.length > 1 && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    Rank {rank} of {siblings.length}{" "}
                    <span className="text-gray-300">
                      &middot; Top {Math.round((rank / siblings.length) * 100)}%
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Score Cards */}
          <div className={`mb-6 grid gap-3 ${isPrompting ? "grid-cols-2 sm:grid-cols-3" : mcqAnswers.length > 0 && promptAnswers.length > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
            {mcqAnswers.length > 0 && (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-[10px] font-semibold tracking-wider text-blue-600">KNOWLEDGE - MCQ</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {Math.round((mcqCorrect / mcqAnswers.length) * 100)}
                  <span className="text-sm font-normal text-gray-400">/100</span>
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {mcqCorrect} of {mcqAnswers.length} correct &middot; auto-graded
                </p>
              </div>
            )}
            {promptAnswers.length > 0 && (
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-[10px] font-semibold tracking-wider text-purple-600">AI PROMPTING</p>
                {report.prompt_evaluated && report.prompt_score != null ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {Math.round(report.prompt_score * 10)}
                      <span className="text-sm font-normal text-gray-400">/100</span>
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {promptAnswers.length} prompt{promptAnswers.length !== 1 ? "s" : ""} &middot; AI-scored
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xl font-bold text-gray-300">--</p>
                    <p className="mt-1 text-[11px] text-yellow-600">Not yet evaluated</p>
                  </>
                )}
              </div>
            )}
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold tracking-wider text-gray-500">COHORT PERCENTILE</p>
              {siblings.length > 1 ? (
                <>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {Math.round(((siblings.length - rank) / (siblings.length - 1)) * 100)}
                    <span className="text-sm font-normal text-gray-400">th</span>
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {scorePct > avgCohortScore ? (
                      <span className="text-green-600">&#9650; above</span>
                    ) : scorePct < avgCohortScore ? (
                      <span className="text-red-600">&#9660; below</span>
                    ) : (
                      <span>at</span>
                    )}{" "}
                    cohort mean of {avgCohortScore}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold text-gray-300">--</p>
                  <p className="mt-1 text-[11px] text-gray-400">Only 1 participant</p>
                </>
              )}
            </div>
          </div>

          {/* Evaluate Prompts Banner */}
          {isPrompting && !report.prompt_evaluated && (
            <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-900">Prompt evaluation pending</p>
                  <p className="text-xs text-purple-600">
                    Run AI evaluation to score the participant&apos;s prompts and generate feedback.
                  </p>
                </div>
                <button
                  onClick={evaluatePrompts}
                  disabled={evaluatingId === report.id}
                  className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {evaluatingId === report.id ? (
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

          {/* Section 01: Competency Breakdown */}
          {report.answers.length > 0 && (
            <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  <span className="mr-1.5 text-xs font-bold text-orange-500">01</span>
                  Competency breakdown
                </h3>
                <p className="text-[11px] text-gray-400">
                  {report.total_questions} questions &middot; by question type
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {mcqAnswers.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        Multiple Choice{" "}
                        <span className="text-xs text-gray-400">{mcqAnswers.length}q</span>
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {Math.round((mcqCorrect / mcqAnswers.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${getScoreBarColor(Math.round((mcqCorrect / mcqAnswers.length) * 100))}`}
                        style={{ width: `${Math.round((mcqCorrect / mcqAnswers.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {promptAnswers.length > 0 && report.prompt_evaluated && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        AI Prompting{" "}
                        <span className="text-xs text-gray-400">{promptAnswers.length}q</span>
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {report.prompt_score != null ? Math.round(report.prompt_score * 10) : 0}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${getScoreBarColor(report.prompt_score != null ? Math.round(report.prompt_score * 10) : 0)}`}
                        style={{
                          width: `${report.prompt_score != null ? Math.round(report.prompt_score * 10) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* Per-question type breakdown for mixed assessments */}
                {report.answers.filter((a) => a.type === "short_answer").length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        Short Answer{" "}
                        <span className="text-xs text-gray-400">
                          {report.answers.filter((a) => a.type === "short_answer").length}q
                        </span>
                      </span>
                      <span className="text-xs text-gray-400">Manual review</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gray-300" style={{ width: "100%" }} />
                    </div>
                  </div>
                )}
                {report.answers.filter((a) => a.type === "long_answer").length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                        Long Answer{" "}
                        <span className="text-xs text-gray-400">
                          {report.answers.filter((a) => a.type === "long_answer").length}q
                        </span>
                      </span>
                      <span className="text-xs text-gray-400">Manual review</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gray-300" style={{ width: "100%" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 02: Question-level Results */}
          <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                <span className="mr-1.5 text-xs font-bold text-orange-500">02</span>
                Question-level results
              </h3>
              <p className="text-[11px] text-gray-400">{report.total_questions} questions</p>
            </div>

            {/* Question List */}
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {/* Header */}
              <div className="grid grid-cols-[80px_1fr_100px_80px] bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                <div className="px-4 py-3">ID</div>
                <div className="px-4 py-3">Question</div>
                <div className="px-4 py-3 text-center">Type</div>
                <div className="px-4 py-3 text-right">Score</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-100">
                {report.answers.map((a, i) => {
                  const qId = `Q-${(a.type === "mcq" ? "MCQ" : a.type === "prompting" ? "PRM" : "ANS").toUpperCase()}-${String(i + 1).padStart(3, "0")}`;
                  const isExpanded = expandedQuestion === i;

                  let scoreDisplay: React.ReactNode;
                  let dotColor: string;

                  if (a.type === "mcq") {
                    scoreDisplay = a.isCorrect ? (
                      <span className="font-semibold text-green-600">1 / 1</span>
                    ) : (
                      <span className="font-semibold text-red-600">0 / 1</span>
                    );
                    dotColor = a.isCorrect ? "bg-green-500" : "bg-red-500";
                  } else if (a.type === "prompting") {
                    if (a.promptScore != null) {
                      scoreDisplay = (
                        <span
                          className={`font-semibold ${
                            a.promptScore >= 7
                              ? "text-green-600"
                              : a.promptScore >= 4
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {a.promptScore} / 10
                        </span>
                      );
                      dotColor =
                        a.promptScore >= 7
                          ? "bg-green-500"
                          : a.promptScore >= 4
                            ? "bg-yellow-500"
                            : "bg-red-500";
                    } else {
                      scoreDisplay = <span className="text-gray-400">--</span>;
                      dotColor = "bg-gray-300";
                    }
                  } else {
                    scoreDisplay = <span className="text-gray-400">--</span>;
                    dotColor = "bg-gray-300";
                  }

                  return (
                    <div key={i}>
                      <button
                        onClick={() => setExpandedQuestion(isExpanded ? null : i)}
                        className="grid w-full grid-cols-[80px_1fr_100px_80px] items-center text-left text-sm hover:bg-gray-50"
                      >
                        <div className="px-4 py-3 font-mono text-xs text-gray-400">{qId}</div>
                        <div className="flex items-center gap-2 px-4 py-3">
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
                          <span className="text-gray-700 line-clamp-1">{a.question}</span>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              a.type === "mcq"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : a.type === "prompting"
                                  ? "border-purple-200 bg-purple-50 text-purple-700"
                                  : "border-gray-200 bg-gray-50 text-gray-600"
                            }`}
                          >
                            {TYPE_LABELS[a.type] || a.type}
                          </span>
                        </div>
                        <div className="px-4 py-3 text-right">{scoreDisplay}</div>
                      </button>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                          {a.type === "mcq" && (
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium text-gray-500">
                                  Participant&apos;s Answer
                                </p>
                                <p
                                  className={`mt-1 text-sm ${
                                    a.isCorrect ? "text-green-700" : "text-red-700"
                                  }`}
                                >
                                  {a.userAnswer || "No answer provided"}
                                </p>
                              </div>
                              {!a.isCorrect && a.correctAnswer && (
                                <div>
                                  <p className="text-xs font-medium text-green-600">Correct Answer</p>
                                  <p className="mt-1 text-sm text-green-700">{a.correctAnswer}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {a.type === "prompting" && (
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium text-gray-500">
                                  Participant&apos;s Prompt
                                </p>
                                <p className="mt-1 whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">
                                  {a.userAnswer || "No answer provided"}
                                </p>
                              </div>

                              {a.promptScore != null && (
                                <div className="rounded-md border border-gray-200 bg-white p-4">
                                  <div className="mb-2 flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                      AI Evaluation &middot; {a.promptScore}/10 Points
                                    </p>
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400">
                                      Auto-scored by AI Eval Engine
                                    </span>
                                  </div>

                                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        a.promptScore >= 7
                                          ? "bg-green-500"
                                          : a.promptScore >= 4
                                            ? "bg-yellow-500"
                                            : "bg-red-500"
                                      }`}
                                      style={{ width: `${a.promptScore * 10}%` }}
                                    />
                                  </div>

                                  {a.promptFeedback && (
                                    <div>
                                      <p className="mb-1 text-xs font-medium text-gray-500">
                                        Auto-Evaluator Notes
                                      </p>
                                      <p className="text-sm leading-relaxed text-gray-600">
                                        {a.promptFeedback}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {a.promptScore == null && (
                                <p className="text-xs italic text-gray-400">
                                  Prompt not yet evaluated. Use the &quot;Evaluate Prompts&quot;
                                  button above.
                                </p>
                              )}
                            </div>
                          )}

                          {a.type !== "mcq" && a.type !== "prompting" && (
                            <div>
                              <p className="text-xs font-medium text-gray-500">
                                Participant&apos;s Answer
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                                {a.userAnswer || "No answer provided"}
                              </p>
                              {a.correctAnswer && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-green-600">Expected Answer</p>
                                  <p className="mt-1 text-sm text-green-700">{a.correctAnswer}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 03: Session Info */}
          <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              <span className="mr-1.5 text-xs font-bold text-orange-500">03</span>
              Session information
            </h3>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Started At
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(report.started_at)}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Completed At
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(report.completed_at)}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Duration
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDuration(report.started_at, report.completed_at)}
                </p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Time Limit
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {report.duration_minutes} min
                </p>
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => prevCandidate && navigateToReport(prevCandidate.id)}
                disabled={!prevCandidate}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                &larr; Previous
              </button>
              <button
                onClick={() => nextCandidate && navigateToReport(nextCandidate.id)}
                disabled={!nextCandidate}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next &rarr;
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sendStatus && (
                <span
                  className={`text-xs ${sendStatus.success ? "text-green-600" : "text-red-600"}`}
                >
                  {sendStatus.message}
                </span>
              )}
              <span className="hidden text-[11px] text-gray-400 sm:inline">
                Report generated {formatDate(report.completed_at)}
              </span>
              <button
                onClick={sendResults}
                disabled={sendingResults}
                className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {sendingResults ? "Sending..." : "Send Results"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
