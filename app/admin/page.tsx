"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("セッションの取得に失敗しました: " + error.message);
    } else {
      setSessions(data ?? []);
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

  function getInterviewUrl(token: string) {
    return `${window.location.origin}/interview/${token}`;
  }

  async function copyUrl(token: string) {
    await navigator.clipboard.writeText(getInterviewUrl(token));
    alert("URLをコピーしました");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">セッション一覧</h1>
        <Link
          href="/admin/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          新しい面接を作成
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>セッションがまだありません</p>
          <Link
            href="/admin/new"
            className="text-blue-600 hover:underline text-sm mt-2 inline-block"
          >
            最初のセッションを作成する →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  候補者名
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  メール
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  ステータス
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  作成日時
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 text-gray-900">
                    {session.candidate_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {session.candidate_email}
                  </td>
                  <td className="px-4 py-3">
                    {session.is_used ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                        使用済み
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        未使用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(session.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyUrl(session.token)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      URLをコピー
                    </button>
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
