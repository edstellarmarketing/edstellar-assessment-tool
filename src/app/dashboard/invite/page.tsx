"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Assessment {
  id: string;
  name: string;
  topic: string;
  total_questions: number;
  duration_minutes: number;
}

interface Invite {
  id: string;
  assessment_id: string;
  email: string;
  status: string;
  otp: string;
  created_at: string;
  assessments: { name: string };
}

export default function InvitePage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Invite modal
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Result modal
  const [inviteResults, setInviteResults] = useState<{
    inviteLink: string;
    otp: string;
    email: string;
    assessmentName: string;
    emailSent: boolean;
    emailNote: string;
  }[]>([]);
  const [copied, setCopied] = useState("");
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  const getAuthHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : "";
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [assessRes, inviteRes] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, name, topic, total_questions, duration_minutes")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("invites")
          .select("id, assessment_id, email, status, otp, created_at, assessments(name)")
          .order("created_at", { ascending: false }),
      ]);

      if (assessRes.data) setAssessments(assessRes.data);
      if (inviteRes.data) setInvites(inviteRes.data as unknown as Invite[]);
      setLoading(false);
    };

    load();
  }, []);

  const handleInvite = async () => {
    if (!selectedAssessment || !email.trim()) return;
    setSending(true);
    setError("");

    // Parse comma/semicolon/newline separated emails
    const emails = email
      .split(/[,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      setError("Please enter at least one email address.");
      setSending(false);
      return;
    }

    const results: typeof inviteResults = [];
    const errors: string[] = [];

    try {
      const authHeader = await getAuthHeader();
      setSendProgress({ current: 0, total: emails.length });

      for (let i = 0; i < emails.length; i++) {
        const addr = emails[i];
        setSendProgress({ current: i + 1, total: emails.length });

        try {
          const res = await fetch("/api/send-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({ assessmentId: selectedAssessment.id, email: addr }),
          });

          const data = await res.json();
          if (!res.ok) {
            errors.push(`${addr}: ${data.error || "Failed"}`);
          } else {
            results.push(data);
          }
        } catch {
          errors.push(`${addr}: Network error`);
        }
      }

      if (errors.length > 0 && results.length === 0) {
        setError(errors.join("; "));
      } else if (errors.length > 0) {
        setError(`Sent ${results.length}/${emails.length}. Failed: ${errors.join("; ")}`);
      }

      if (results.length > 0) {
        setInviteResults(results);
      }

      setSelectedAssessment(null);
      setEmail("");

      // Refresh invites
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: newInvites } = await supabase
          .from("invites")
          .select("id, assessment_id, email, status, otp, created_at, assessments(name)")
          .order("created_at", { ascending: false });
        if (newInvites) setInvites(newInvites as unknown as Invite[]);
      }
    } catch {
      setError("Failed to send invites");
    }

    setSending(false);
    setSendProgress(null);
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleClearInvites = async () => {
    setClearing(true);
    const ids = invites.map((inv) => inv.id);
    const { error: delError } = await supabase
      .from("invites")
      .delete()
      .in("id", ids);

    setClearing(false);
    setConfirmClear(false);

    if (delError) {
      setError("Failed to clear invites: " + delError.message);
    } else {
      setInvites([]);
    }
  };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    started: "bg-blue-50 text-blue-700",
    completed: "bg-green-50 text-green-700",
    expired: "bg-gray-100 text-gray-500",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Invite Participants</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Assessments to invite */}
      {assessments.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">No assessments available</h3>
          <p className="mt-1 text-sm text-gray-500">Create an assessment first to start inviting participants.</p>
          <a
            href="/dashboard/assessments/new"
            className="mt-4 inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Assessment
          </a>
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assessments.map((a) => (
              <div key={a.id} className="rounded-lg bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">{a.name}</h3>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{a.topic}</p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {a.total_questions} Q
                  </span>
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {a.duration_minutes} min
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAssessment(a)}
                  className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Invite
                </button>
              </div>
            ))}
          </div>

          {/* Sent invites */}
          {invites.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Sent Invites</h3>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Clear all invites?</span>
                    <button
                      onClick={handleClearInvites}
                      disabled={clearing}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {clearing ? "Clearing..." : "Yes, clear all"}
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Assessment</th>
                      <th className="px-4 py-3 font-medium text-gray-600">OTP</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Sent</th>
                      <th className="px-4 py-3 font-medium text-gray-600">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invites.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 text-gray-900">{inv.email}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {inv.assessments?.name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
                            {inv.otp}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              statusColor[inv.status] || "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              copyToClipboard(
                                `${window.location.origin}/assessment/${inv.id}`,
                                inv.id
                              )
                            }
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {copied === inv.id ? "Copied!" : "Copy Link"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invite Modal */}
      {selectedAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-bold text-gray-900">Invite Participants</h3>
            <p className="mb-5 text-sm text-gray-500">
              Send invites for <span className="font-medium text-gray-700">{selectedAssessment.name}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Participant Email(s)
              </label>
              <textarea
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={"participant@example.com\nor comma separated:\nuser1@example.com, user2@example.com"}
                rows={3}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Separate multiple emails with commas, semicolons, or new lines.</p>
            </div>
            {sendProgress && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Sending invites...</span>
                  <span>{sendProgress.current}/{sendProgress.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedAssessment(null);
                  setEmail("");
                }}
                disabled={sending}
                className="rounded-md bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={sending || !email.trim()}
                className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? `Sending${sendProgress ? ` (${sendProgress.current}/${sendProgress.total})` : "..."}` : `Send Invite${email.includes(",") || email.includes(";") || email.includes("\n") ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Result Modal */}
      {inviteResults.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <span className="text-xl">✓</span>
            </div>
            <h3 className="mb-1 text-lg font-bold text-gray-900">
              {inviteResults.length === 1 ? "Invite Created!" : `${inviteResults.length} Invites Created!`}
            </h3>

            {inviteResults.length === 1 ? (
              <>
                {inviteResults[0].emailSent ? (
                  <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
                    Email sent to {inviteResults[0].email}
                  </div>
                ) : (
                  <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-700">
                    Email not sent: {inviteResults[0].emailNote || "Unknown error"}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Assessment Link</label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
                        {inviteResults[0].inviteLink}
                      </code>
                      <button
                        onClick={() => copyToClipboard(inviteResults[0].inviteLink, "link")}
                        className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {copied === "link" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">OTP Code</label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded-md bg-gray-50 px-3 py-2 text-lg font-bold tracking-widest text-gray-900">
                        {inviteResults[0].otp}
                      </code>
                      <button
                        onClick={() => copyToClipboard(inviteResults[0].otp, "otp")}
                        className="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {copied === "otp" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Copy All</label>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `You've been invited to take the assessment: ${inviteResults[0].assessmentName}\n\nLink: ${inviteResults[0].inviteLink}\nOTP: ${inviteResults[0].otp}`,
                          "all"
                        )
                      }
                      className="mt-1 w-full rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      {copied === "all" ? "Copied to clipboard!" : "Copy link + OTP as message"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
                  {inviteResults.filter((r) => r.emailSent).length}/{inviteResults.length} emails sent successfully
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {inviteResults.map((r, i) => (
                    <div key={i} className="rounded-md border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{r.email}</span>
                        <span className={`text-xs font-medium ${r.emailSent ? "text-green-600" : "text-yellow-600"}`}>
                          {r.emailSent ? "Sent" : "Not sent"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                        <span>OTP: <code className="font-mono font-bold text-gray-700">{r.otp}</code></span>
                        <button
                          onClick={() => copyToClipboard(r.inviteLink, `link-${i}`)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {copied === `link-${i}` ? "Copied!" : "Copy Link"}
                        </button>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `You've been invited to take the assessment: ${r.assessmentName}\n\nLink: ${r.inviteLink}\nOTP: ${r.otp}`,
                              `all-${i}`
                            )
                          }
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {copied === `all-${i}` ? "Copied!" : "Copy All"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        inviteResults
                          .map((r) => `${r.email}\nLink: ${r.inviteLink}\nOTP: ${r.otp}`)
                          .join("\n\n"),
                        "bulk-all"
                      )
                    }
                    className="w-full rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {copied === "bulk-all" ? "Copied all to clipboard!" : "Copy all links + OTPs"}
                  </button>
                </div>
              </>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setInviteResults([])}
                className="rounded-md bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
