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

const AGENT_EMAILS_KEY = "agentEmailHistory";

function loadAgentEmailHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(AGENT_EMAILS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveAgentEmail(email: string) {
  const history = loadAgentEmailHistory();
  if (!history.includes(email)) {
    localStorage.setItem(AGENT_EMAILS_KEY, JSON.stringify([email, ...history].slice(0, 10)));
  }
}

const URL_MESSAGE = `※このリンクは一度踏むと、二度目は期限切れとなり、回答できなくなります。
　音声のみ(orテキスト)で回答が可能ですが、なるべく面接と近い静かな環境をご準備ください。
　音声をご利用の場合はchromeが推奨環境です。Safariやスマホなどの場合音声機能が使えない場合がございます。`;

export default function NewSessionPage() {
  const router = useRouter();
  const [candidateName, setCandidateName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentEmailHistory, setAgentEmailHistory] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { question_text: "", time_limit_seconds: 120 },
  ]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    loadTemplates();
    setAgentEmailHistory(loadAgentEmailHistory());
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
    setQuestions((prev) => [
      ...prev,
      { question_text: "", time_limit_seconds: 120 },
    ]);
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

    if (!candidateName.trim()) {
      setError("候補者氏名を入力してください");
      return;
    }
    if (!agentEmail.trim()) {
      setError("担当エージェントメールアドレスを入力してください");
      return;
    }
    const validQuestions = questions.filter((q) => q.question_text.trim());
    if (validQuestions.length === 0) {
      setError("少なくとも1つの質問を入力してください");
      return;
    }

    setSubmitting(true);

    const { data: session, error: sessionError } = await getSupabase()
      .from("sessions")
      .insert({
        candidate_name: candidateName.trim(),
        candidate_email: "",
        agent_email: agentEmail.trim(),
      })
      .select()
      .single();

    if (sessionError || !session) {
      setError("セッションの作成に失敗しました");
      setSubmitting(false);
      return;
    }

    const { error: questionsError } = await getSupabase().from("questions").insert(
      validQuestions.map((q, i) => ({
        session_id: session.id,
        order_index: i,
        question_text: q.question_text.trim(),
        time_limit_seconds: q.time_limit_seconds,
      }))
    );

    if (questionsError) {
      setError("質問の保存に失敗しました");
      setSubmitting(false);
      return;
    }

    saveAgentEmail(agentEmail.trim());
    setGeneratedUrl(`${window.location.origin}/interview/${session.token}`);
    setSubmitting(false);
  }

  async function copyUrl() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  async function copyAll() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(`${generatedUrl}\n\n${URL_MESSAGE}`);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  function resetForm() {
    setGeneratedUrl(null);
    setCandidateName("");
    setAgentEmail("");
    setQuestions([{ question_text: "", time_limit_seconds: 120 }]);
    setSelectedTemplateId("");
  }

  if (generatedUrl) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">URL発行完了</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {/* URL */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">発行されたURL</p>
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
                {copiedUrl ? "コピーしました" : "URLをコピー"}
              </button>
            </div>
          </div>

          {/* 案内文 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">エージェントへの案内文</p>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {generatedUrl}{"\n\n"}{URL_MESSAGE}
            </div>
            <button
              onClick={copyAll}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              {copiedAll ? "コピーしました" : "URL＋案内文をまとめてコピー"}
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              続けて作成
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              一覧に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        新しい面接セッションを作成
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 候補者情報 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            候補者情報
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                氏名
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="山田 太郎"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                担当エージェントメールアドレス
              </label>
              <input
                type="email"
                list="agent-email-history"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="agent@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {agentEmailHistory.length > 0 && (
                <datalist id="agent-email-history">
                  {agentEmailHistory.map((email) => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
              )}
              {agentEmailHistory.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {agentEmailHistory.map((email) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => setAgentEmail(email)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        agentEmail === email
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {email}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                候補者がPDFを送付する宛先として表示されます
              </p>
            </div>
          </div>
        </section>

        {/* 質問設定 */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            質問設定
          </h2>

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
                    onChange={(e) =>
                      updateQuestion(index, "question_text", e.target.value)
                    }
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
                        updateQuestion(
                          index,
                          "time_limit_seconds",
                          parseTimeLimit(e.target.value)
                        )
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

        {/* 送信 */}
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
