"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [openrouterKey, setOpenrouterKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [showOpenrouter, setShowOpenrouter] = useState(false);
  const [showTavily, setShowTavily] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      setUser(session.user);

      const { data } = await supabase
        .from("settings")
        .select("openrouter_api_key, tavily_api_key")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        setOpenrouterKey(data.openrouter_api_key || "");
        setTavilyKey(data.tavily_api_key || "");
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("settings")
      .upsert(
        {
          user_id: user.id,
          openrouter_api_key: openrouterKey || null,
          tavily_api_key: tavilyKey || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: "Failed to save settings." });
    } else {
      setMessage({ type: "success", text: "Settings saved successfully." });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-gray-900">
              Admin Dashboard
            </h1>
            <nav className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Home
              </a>
              <a
                href="/dashboard/settings"
                className="text-sm font-medium text-gray-900"
              >
                Settings
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/");
              }}
              className="rounded-md bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">
            API Key Settings
          </h2>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="space-y-6">
              {/* OpenRouter API Key */}
              <div>
                <label
                  htmlFor="openrouter"
                  className="block text-sm font-medium text-gray-700"
                >
                  OpenRouter API Key
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Used for LLM routing. Get your key at openrouter.ai
                </p>
                <div className="relative">
                  <input
                    id="openrouter"
                    type={showOpenrouter ? "text" : "password"}
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    placeholder="sk-or-..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenrouter(!showOpenrouter)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showOpenrouter ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Tavily API Key */}
              <div>
                <label
                  htmlFor="tavily"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tavily API Key
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Used for AI-powered search. Get your key at tavily.com
                </p>
                <div className="relative">
                  <input
                    id="tavily"
                    type={showTavily ? "text" : "password"}
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    placeholder="tvly-..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTavily(!showTavily)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showTavily ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`mt-4 rounded-md p-3 text-sm ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <div className="mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
