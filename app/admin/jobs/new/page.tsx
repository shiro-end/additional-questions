"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Database, TemplateQuestion } from "@/types/database";

type Template = Database["public"]["Tables"]["templates"]["Row"];

interface QuestionItem {
  question_text: string;
  time_limit_seconds: number;
}

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { question_text: "", time_limit_seconds: 120 },
  ]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const { data } = await getSupabase()
      .from("templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setTemplates(data);
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const templateQuestions = template.questions as TemplateQuestion[];
    setQuestions(
      templateQuestions.map((q) => ({
        question_text: q.question_text,
        time_limit_seconds: q.time_limit_seconds,
      }))
    );
  }

  function updateQuestion(index: number, field: keyof QuestionItem, value: string | number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { question_text: "", time_limit_seconds: 120 }]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  }

  function formatTimeLimit(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function parseTimeLimit(value: string): number {
    if (value.includes(":")) {
      const [m, s] = value.split(":").map(Number);
      return (m || 0) * 60 + (s || 0);
    }
    return parseInt(value, 10) || 120;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("求人名を入力してください");
      return;
    }
    const validQuestions = questions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      setError("少なくとも1つの質問を入力してください");
      return;
    }

    setSubmitting(true);

    const { data: job, error: jobError } = await getSupabase()
      .from("job_postings")
      .insert({ title: title.trim() } as never)
      .select()
      .single();

    if (jobError || !job) {
      setError("求人の作成に失敗しました");
      setSubmitting(false);
      return;
    }

    const { error: questionsError } = await getSupabase()
      .from("job_questions")
      .insert(
        validQuestions.map((q, i) => ({
          job_id: (job as { id: string }).id,
          order_index: i,
          question_text: q.question_text.trim(),
          time_limit_seconds: q.time_limit_seconds,
        })) as never[]
      );

    if (questionsError) {
      setError("質問の保存に失敗しました");
      setSubmitting(false);
      return;
    }

    setGeneratedUrl(`${window.location.origin}/apply/${(job as { id: string }).id}`);
    setSubmitting(false);
  }

  async function copyUrl() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (generatedUrl) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">求人URL発行完了</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">発行された共通URL</p>
            <p className="text-xs text-gray-500 mb-2">
              このURLは求人に応募する全候補者で共通です。エージェント経由で候補者に共有してください。
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-800"
              />
              <button
                onClick={copyUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
              >
                {copied ? "コピーしました" : "URLをコピー"}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push("/admin/jobs")}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              求人一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新しい求人を作成</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">求人情報</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              求人名（管理用）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: エンジニア採用 2024年春"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">候補者には表示されません</p>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">質問設定</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              テンプレートから選択
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- テンプレートを選択 --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {questions.map((q, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-md"
              >
                <span className="text-sm font-medium text-gray-400 mt-2 w-6 text-center shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestion(index, "question_text", e.target.value)}
                    placeholder="質問を入力"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">制限時間:</label>
                    <input
                      type="text"
                      value={formatTimeLimit(q.time_limit_seconds)}
                      onChange={(e) =>
                        updateQuestion(index, "time_limit_seconds", parseTimeLimit(e.target.value))
                      }
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="2:00"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    disabled={questions.length <= 1}
                    className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addQuestion}
            className="mt-3 px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 w-full"
          >
            + 質問を追加
          </button>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "作成中..." : "URLを発行する"}
          </button>
        </div>
      </form>
    </div>
  );
}
