"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
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
                className="text-sm font-medium text-gray-900"
              >
                Home
              </a>
              <a
                href="/dashboard/settings"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Settings
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-md bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
          <a
            href="/dashboard/assessments/new"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            + Create New Assessment
          </a>
        </div>
      </main>
    </div>
  );
}
