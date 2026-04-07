"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Database, TemplateQuestion } from "@/types/database";

type Template = Database["public"]["Tables"]["templates"]["Row"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規作成フォーム
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formQuestions, setFormQuestions] = useState<TemplateQuestion[]>([
    { question_text: "", time_limit_seconds: 180 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // 編集中のテンプレートID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuestions, setEditQuestions] = useState<TemplateQuestion[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from("templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setError("テンプレートの取得に失敗しました");
    } else {
      setTemplates(data ?? []);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formName.trim()) {
      setError("テンプレート名を入力してください");
      return;
    }
    const validQuestions = formQuestions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      setError("少なくとも1つの質問を入力してください");
      return;
    }

    setSubmitting(true);
    const { error } = await getSupabase().from("templates").insert({
      name: formName.trim(),
      questions: validQuestions as unknown as TemplateQuestion[],
    });

    if (error) {
      setError("テンプレートの作成に失敗しました");
    } else {
      setFormName("");
      setFormQuestions([{ question_text: "", time_limit_seconds: 180 }]);
      setShowForm(false);
      await loadTemplates();
    }
    setSubmitting(false);
  }

  function startEdit(template: Template) {
    setEditingId(template.id);
    setEditName(template.name);
    setEditQuestions(
      (template.questions as TemplateQuestion[]).map((q) => ({ ...q }))
    );
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);

    if (!editName.trim()) {
      setError("テンプレート名を入力してください");
      return;
    }
    const validQuestions = editQuestions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      setError("少なくとも1つの質問を入力してください");
      return;
    }

    const { error } = await getSupabase()
      .from("templates")
      .update({
        name: editName.trim(),
        questions: validQuestions as unknown as TemplateQuestion[],
      })
      .eq("id", editingId);

    if (error) {
      setError("テンプレートの更新に失敗しました");
    } else {
      setEditingId(null);
      await loadTemplates();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このテンプレートを削除しますか？")) return;
    const { error } = await getSupabase().from("templates").delete().eq("id", id);
    if (error) {
      setError("削除に失敗しました");
    } else {
      await loadTemplates();
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">テンプレート管理</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            新規テンプレート作成
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 新規作成フォーム */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            新規テンプレート
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                テンプレート名
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例: 汎用（中途）"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <QuestionListEditor
              questions={formQuestions}
              onChange={setFormQuestions}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormName("");
                  setFormQuestions([
                    { question_text: "", time_limit_seconds: 180 },
                  ]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* テンプレート一覧 */}
      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : templates.length === 0 ? (
        <p className="text-center py-12 text-gray-500">
          テンプレートがまだありません
        </p>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              {editingId === template.id ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      テンプレート名
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <QuestionListEditor
                    questions={editQuestions}
                    onChange={setEditQuestions}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                    >
                      更新
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">
                      {template.name}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(template)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {(template.questions as TemplateQuestion[]).map((q, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-gray-400 w-5 shrink-0">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{q.question_text}</span>
                        <span className="text-gray-400 shrink-0">
                          {formatTime(q.time_limit_seconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 質問リスト編集コンポーネント
function QuestionListEditor({
  questions,
  onChange,
}: {
  questions: TemplateQuestion[];
  onChange: (questions: TemplateQuestion[]) => void;
}) {
  function update(index: number, field: keyof TemplateQuestion, value: string | number) {
    onChange(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function add() {
    onChange([...questions, { question_text: "", time_limit_seconds: 180 }]);
  }

  function remove(index: number) {
    if (questions.length <= 1) return;
    onChange(questions.filter((_, i) => i !== index));
  }

  function parseTime(value: string): number {
    if (value.includes(":")) {
      const [m, s] = value.split(":").map(Number);
      return (m || 0) * 60 + (s || 0);
    }
    return parseInt(value, 10) || 180;
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        質問リスト
      </label>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
            <span className="text-sm text-gray-400 mt-2 w-5 text-center shrink-0">
              {i + 1}
            </span>
            <textarea
              value={q.question_text}
              onChange={(e) => update(i, "question_text", e.target.value)}
              placeholder="質問を入力"
              rows={2}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <input
              type="text"
              value={formatTime(q.time_limit_seconds)}
              onChange={(e) =>
                update(i, "time_limit_seconds", parseTime(e.target.value))
              }
              className="w-16 px-2 py-2 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3:00"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={questions.length <= 1}
              className="px-2 py-2 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 w-full"
      >
        + 質問を追加
      </button>
    </div>
  );
}
