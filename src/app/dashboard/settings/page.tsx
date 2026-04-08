"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface ApiKey {
  id: string;
  label: string;
  field: "openrouter_api_key" | "tavily_api_key";
  placeholder: string;
  description: string;
}

const API_KEYS: ApiKey[] = [
  {
    id: "openrouter",
    label: "OpenRouter API Key",
    field: "openrouter_api_key",
    placeholder: "sk-or-...",
    description: "Used for LLM routing. Get your key at openrouter.ai",
  },
  {
    id: "tavily",
    label: "Tavily API Key",
    field: "tavily_api_key",
    placeholder: "tvly-...",
    description: "Used for AI-powered search. Get your key at tavily.com",
  },
];

const OPENROUTER_MODELS = [
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "ChatGPT" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "ChatGPT" },
  { id: "openai/gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "ChatGPT" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "ChatGPT" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "ChatGPT" },
  { id: "openai/o3-mini", name: "o3 Mini", provider: "ChatGPT" },
  { id: "openai/o4-mini", name: "o4 Mini", provider: "ChatGPT" },
  { id: "anthropic/claude-opus-4", name: "Claude Opus 4", provider: "Claude" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Claude" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Claude" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Claude" },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", provider: "Gemini" },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", provider: "Gemini" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Gemini" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "deepseek/deepseek-r1-0528", name: "DeepSeek R1 0528", provider: "DeepSeek" },
];

interface SettingsData {
  openrouter_api_key: string;
  tavily_api_key: string;
  openrouter_model: string;
}

const EMPTY_SETTINGS: SettingsData = {
  openrouter_api_key: "",
  tavily_api_key: "",
  openrouter_model: "",
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Current form state
  const [settings, setSettings] = useState<SettingsData>({ ...EMPTY_SETTINGS });
  // Last saved state from DB
  const [savedSettings, setSavedSettings] = useState<SettingsData>({ ...EMPTY_SETTINGS });

  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deletingField, setDeletingField] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [savingModel, setSavingModel] = useState(false);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const fetchSettings = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("settings")
      .select("openrouter_api_key, tavily_api_key, openrouter_model")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch settings:", error);
      return;
    }

    if (data) {
      const loaded: SettingsData = {
        openrouter_api_key: data.openrouter_api_key || "",
        tavily_api_key: data.tavily_api_key || "",
        openrouter_model: data.openrouter_model || "",
      };
      setSettings(loaded);
      setSavedSettings(loaded);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          router.push("/");
          return;
        }

        setUser(session.user);
        await fetchSettings(session.user.id);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router, fetchSettings]);

  // Save a single field — always writes all fields to prevent overwrites
  const saveToDb = async (newSettings: SettingsData): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase.from("settings").upsert(
      {
        user_id: user.id,
        openrouter_api_key: newSettings.openrouter_api_key || null,
        tavily_api_key: newSettings.tavily_api_key || null,
        openrouter_model: newSettings.openrouter_model || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Failed to save settings:", error);
      return false;
    }

    setSavedSettings({ ...newSettings });
    return true;
  };

  const handleSave = async (field: string) => {
    if (!user) return;
    setSavingField(field);

    const newSettings = { ...savedSettings, [field]: settings[field as keyof SettingsData] };
    const ok = await saveToDb(newSettings);

    setSavingField(null);

    if (ok) {
      setSettings(newSettings);
      setEditing((prev) => ({ ...prev, [field]: false }));
      showMessage("success", "API key saved.");
    } else {
      showMessage("error", "Failed to save key.");
    }
  };

  const handleDelete = async (field: string) => {
    if (!user) return;
    setDeletingField(field);

    const newSettings = { ...savedSettings, [field]: "" };
    const ok = await saveToDb(newSettings);

    setDeletingField(null);
    setConfirmDelete(null);

    if (ok) {
      setSettings(newSettings);
      setEditing((prev) => ({ ...prev, [field]: false }));
      showMessage("success", "API key deleted.");
    } else {
      showMessage("error", "Failed to delete key.");
    }
  };

  const handleCancel = (field: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: savedSettings[field as keyof SettingsData],
    }));
    setEditing((prev) => ({ ...prev, [field]: false }));
    setConfirmDelete(null);
  };

  const handleSaveModel = async () => {
    if (!user) return;
    setSavingModel(true);

    const newSettings = { ...savedSettings, openrouter_model: settings.openrouter_model };
    const ok = await saveToDb(newSettings);

    setSavingModel(false);

    if (ok) {
      showMessage("success", "Model saved.");
    } else {
      showMessage("error", "Failed to save model.");
    }
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
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

          {/* Message */}
          {message && (
            <div
              className={`mb-6 rounded-md p-3 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Model Selection */}
          <div className="mb-4 rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  OpenRouter Model
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Choose which LLM model to use via OpenRouter
                </p>
              </div>
              {savedSettings.openrouter_model && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {OPENROUTER_MODELS.find((m) => m.id === savedSettings.openrouter_model)?.name ||
                    savedSettings.openrouter_model}
                </span>
              )}
            </div>

            <div className="mt-4">
              <select
                value={settings.openrouter_model}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, openrouter_model: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a model...</option>
                {(() => {
                  const grouped: Record<string, typeof OPENROUTER_MODELS> = {};
                  for (const model of OPENROUTER_MODELS) {
                    if (!grouped[model.provider]) grouped[model.provider] = [];
                    grouped[model.provider].push(model);
                  }
                  return Object.entries(grouped).map(([provider, models]) => (
                    <optgroup key={provider} label={provider}>
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSaveModel}
                disabled={
                  savingModel || settings.openrouter_model === savedSettings.openrouter_model
                }
                className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingModel ? "Saving..." : "Save Model"}
              </button>
              {savedSettings.openrouter_model &&
                settings.openrouter_model !== savedSettings.openrouter_model && (
                  <button
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        openrouter_model: savedSettings.openrouter_model,
                      }))
                    }
                    className="rounded-md bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                )}
            </div>
          </div>

          <div className="space-y-4">
            {API_KEYS.map((apiKey) => {
              const value = settings[apiKey.field];
              const saved = savedSettings[apiKey.field];
              const isEditing = editing[apiKey.field];
              const isVisible = visibility[apiKey.field];
              const hasSavedKey = !!saved;

              return (
                <div
                  key={apiKey.id}
                  className="rounded-lg bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {apiKey.label}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {apiKey.description}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        hasSavedKey
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {hasSavedKey ? "Configured" : "Not set"}
                    </span>
                  </div>

                  {/* View mode */}
                  {!isEditing && hasSavedKey && (
                    <div className="mt-4">
                      <div className="flex items-center gap-3">
                        <code className="flex-1 rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          {isVisible ? saved : maskKey(saved)}
                        </code>
                        <button
                          onClick={() =>
                            setVisibility((prev) => ({
                              ...prev,
                              [apiKey.field]: !prev[apiKey.field],
                            }))
                          }
                          className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          {isVisible ? "Hide" : "Show"}
                        </button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() =>
                            setEditing((prev) => ({
                              ...prev,
                              [apiKey.field]: true,
                            }))
                          }
                          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        {confirmDelete === apiKey.field ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600">
                              Are you sure?
                            </span>
                            <button
                              onClick={() => handleDelete(apiKey.field)}
                              disabled={deletingField === apiKey.field}
                              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingField === apiKey.field
                                ? "Deleting..."
                                : "Yes, delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(apiKey.field)}
                            className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Edit / Create mode */}
                  {(isEditing || !hasSavedKey) && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            [apiKey.field]: e.target.value,
                          }))
                        }
                        placeholder={apiKey.placeholder}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleSave(apiKey.field)}
                          disabled={
                            !value.trim() || savingField === apiKey.field
                          }
                          className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingField === apiKey.field
                            ? "Saving..."
                            : hasSavedKey
                              ? "Update"
                              : "Save"}
                        </button>
                        {hasSavedKey && (
                          <button
                            onClick={() => handleCancel(apiKey.field)}
                            className="rounded-md bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
