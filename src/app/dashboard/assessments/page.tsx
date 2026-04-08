"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Assessment {
  id: string;
  name: string;
  topic: string;
  total_questions: number;
  duration_minutes: number;
  questions: unknown[];
  created_at: string;
}

export default function ManageAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal state
  const [editAssessment, setEditAssessment] = useState<Assessment | null>(null);
  const [editName, setEditName] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  // View modal state
  const [viewAssessment, setViewAssessment] = useState<Assessment | null>(null);

  const fetchAssessments = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error: fetchError } = await supabase
      .from("assessments")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("Failed to load assessments: " + fetchError.message);
    } else {
      setAssessments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const { error: delError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", id);

    setDeleting(false);
    setDeleteId(null);

    if (delError) {
      setError("Failed to delete: " + delError.message);
    } else {
      setAssessments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const openEdit = (a: Assessment) => {
    setEditAssessment(a);
    setEditName(a.name);
    setEditTopic(a.topic);
    setEditDuration(a.duration_minutes);
  };

  const handleEdit = async () => {
    if (!editAssessment) return;
    setSaving(true);

    const { error: updateError } = await supabase
      .from("assessments")
      .update({
        name: editName,
        topic: editTopic,
        duration_minutes: editDuration,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editAssessment.id);

    setSaving(false);

    if (updateError) {
      setError("Failed to update: " + updateError.message);
    } else {
      setEditAssessment(null);
      fetchAssessments();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading assessments...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Manage Assessments</h2>
        <a
          href="/dashboard/assessments/new"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + Create New
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {assessments.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No assessments yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first assessment to get started.</p>
          <a
            href="/dashboard/assessments/new"
            className="mt-4 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Assessment
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <div key={a.id} className="rounded-lg bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{a.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{a.topic}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {a.total_questions} questions
                    </span>
                    <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                      {a.duration_minutes} min
                    </span>
                    <span className="text-xs text-gray-400">
                      Created {formatDate(a.created_at)}
                    </span>
                  </div>
                </div>
                <div className="ml-4 flex gap-2">
                  <button
                    onClick={() => setViewAssessment(a)}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    View
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  {deleteId === a.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deleting}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {viewAssessment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{viewAssessment.name}</h3>
              <button
                onClick={() => setViewAssessment(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-4 flex gap-3">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {viewAssessment.total_questions} questions
              </span>
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                {viewAssessment.duration_minutes} min
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                Topic: {viewAssessment.topic}
              </span>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {(viewAssessment.questions as Array<{
                question: string;
                type: string;
                options?: string[];
                correct_answer?: string;
              }>).map((q, i) => (
                <div key={i} className="rounded-md border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">Question {i + 1}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {q.type === "mcq" ? "MCQ" : q.type === "short_answer" ? "Short Answer" : q.type === "long_answer" ? "Long Answer" : "Attachment"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{q.question}</p>
                  {q.type === "mcq" && q.options && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, j) => (
                        <div
                          key={j}
                          className={`rounded px-2 py-1 text-sm ${
                            opt === q.correct_answer ? "bg-green-50 font-medium text-green-700" : "text-gray-600"
                          }`}
                        >
                          {String.fromCharCode(65 + j)}. {opt} {opt === q.correct_answer && "✓"}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type !== "mcq" && q.correct_answer && (
                    <div className="mt-2 rounded bg-green-50 p-2">
                      <span className="text-xs font-medium text-green-600">Answer:</span>
                      <p className="text-sm text-green-700">{q.correct_answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setViewAssessment(null)}
                className="rounded-md bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-gray-900">Edit Assessment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Assessment Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Topic</label>
                <input
                  type="text"
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={editDuration}
                  onChange={(e) => setEditDuration(parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditAssessment(null)}
                className="rounded-md bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={saving || !editName.trim()}
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
