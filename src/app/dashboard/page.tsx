"use client";

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
        <a
          href="/dashboard/assessments/new"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + Create New Assessment
        </a>
      </div>
    </div>
  );
}
