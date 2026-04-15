"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

interface JobPosting {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("求人の取得に失敗しました");
    } else {
      setJobs((data ?? []) as JobPosting[]);
    }
    setLoading(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getApplyUrl(id: string) {
    return `${window.location.origin}/apply/${id}`;
  }

  async function copyUrl(id: string) {
    await navigator.clipboard.writeText(getApplyUrl(id));
    alert("URLをコピーしました");
  }

  async function toggleActive(job: JobPosting) {
    const { error } = await getSupabase()
      .from("job_postings")
      .update({ is_active: !job.is_active } as never)
      .eq("id", job.id);

    if (error) {
      setError("更新に失敗しました");
    } else {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, is_active: !j.is_active } : j))
      );
    }
  }

  async function deleteJob(id: string) {
    setDeletingId(id);
    const { error } = await getSupabase().from("job_postings").delete().eq("id", id);
    if (error) {
      setError("削除に失敗しました");
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== id));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">求人管理</h1>
        <Link
          href="/admin/jobs/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          新しい求人を作成
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>求人がまだありません</p>
          <Link
            href="/admin/jobs/new"
            className="text-blue-600 hover:underline text-sm mt-2 inline-block"
          >
            最初の求人を作成する →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">求人名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">作成日時</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-900">{job.title}</td>
                  <td className="px-4 py-3">
                    {job.is_active ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        公開中
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                        非公開
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(job.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {job.is_active && (
                        <button
                          onClick={() => copyUrl(job.id)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          URLをコピー
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(job)}
                        className="text-gray-500 hover:underline text-xs"
                      >
                        {job.is_active ? "非公開にする" : "公開する"}
                      </button>
                      {confirmDeleteId === job.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => deleteJob(job.id)}
                            disabled={deletingId === job.id}
                            className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {deletingId === job.id ? "削除中..." : "削除する"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                          >
                            キャンセル
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(job.id)}
                          className="text-red-500 hover:underline text-xs"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
