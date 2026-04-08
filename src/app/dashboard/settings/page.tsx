"use client";

import { useEffect, useState } from "react";
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
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "OpenAI" },
  { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI" },
  { id: "openai/o3-mini", name: "o3 Mini", provider: "OpenAI" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", provider: "Google" },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", provider: "Google" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", provider: "Meta" },
  { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout", provider: "Meta" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "mistralai/mistral-large-2411", name: "Mistral Large", provider: "Mistral" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", provider: "Qwen" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [keys, setKeys] = useState<Record<string, string>>({
    openrouter_api_key: "",
    tavily_api_key: "",
  });
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({
    openrouter_api_key: "",
    tavily_api_key: "",
  });
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [deletingField, setDeletingField] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [savedModel, setSavedModel] = useState("");
  const [savingModel, setSavingModel] = useState(false);

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
        .select("openrouter_api_key, tavily_api_key, openrouter_model")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        const loaded: Record<string, string> = {
          openrouter_api_key: data.openrouter_api_key || "",
          tavily_api_key: data.tavily_api_key || "",
        };
        setKeys(loaded);
        setSavedKeys(loaded);
        setSelectedModel(data.openrouter_model || "");
        setSavedModel(data.openrouter_model || "");
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (field: string) => {
    if (!user) return;
    setSavingField(field);

    const { error } = await supabase.from("settings").upsert(
      {
        user_id: user.id,
        [field]: keys[field] || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSavingField(null);

    if (error) {
      showMessage("error", "Failed to save key.");
    } else {
      setSavedKeys((prev) => ({ ...prev, [field]: keys[field] }));
      setEditing((prev) => ({ ...prev, [field]: false }));
      showMessage("success", "API key saved.");
    }
  };

  const handleDelete = async (field: string) => {
    if (!user) return;
    setDeletingField(field);

    const { error } = await supabase.from("settings").upsert(
      {
        user_id: user.id,
        [field]: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setDeletingField(null);
    setConfirmDelete(null);

    if (error) {
      showMessage("error", "Failed to delete key.");
    } else {
      setKeys((prev) => ({ ...prev, [field]: "" }));
      setSavedKeys((prev) => ({ ...prev, [field]: "" }));
      setEditing((prev) => ({ ...prev, [field]: false }));
      showMessage("success", "API key deleted.");
    }
  };

  const handleCancel = (field: string) => {
    setKeys((prev) => ({ ...prev, [field]: savedKeys[field] }));
    setEditing((prev) => ({ ...prev, [field]: false }));
    setConfirmDelete(null);
  };

  const handleSaveModel = async () => {
    if (!user) return;
    setSavingModel(true);

    const { error } = await supabase.from("settings").upsert(
      {
        user_id: user.id,
        openrouter_model: selectedModel || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSavingModel(false);

    if (error) {
      showMessage("error", "Failed to save model.");
    } else {
      setSavedModel(selectedModel);
      showMessage("success", "Model saved.");
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
              {savedModel && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {OPENROUTER_MODELS.find((m) => m.id === savedModel)?.name ||
                    savedModel}
                </span>
              )}
            </div>

            <div className="mt-4">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
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
                  savingModel || selectedModel === savedModel
                }
                className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingModel ? "Saving..." : "Save Model"}
              </button>
              {savedModel && selectedModel !== savedModel && (
                <button
                  onClick={() => setSelectedModel(savedModel)}
                  className="rounded-md bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {API_KEYS.map((apiKey) => {
              const value = keys[apiKey.field];
              const saved = savedKeys[apiKey.field];
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
                          setKeys((prev) => ({
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
