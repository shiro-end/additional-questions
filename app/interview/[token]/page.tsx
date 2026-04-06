"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Question = Database["public"]["Tables"]["questions"]["Row"];

type InputMethod = "voice" | "text";
type Step = "loading" | "invalid" | "used" | "consent" | "mic-test" | "answer" | "confirm" | "done";

// ブラウザ判定: Chrome/EdgeならWeb Speech APIが安定
function isSpeechApiStable(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome|Edg/.test(ua) && !/OPR/.test(ua);
}

function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

interface Props {
  params: { token: string };
}

export default function InterviewPage({ params }: Props) {
  const [step, setStep] = useState<Step>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [inputMethod, setInputMethod] = useState<InputMethod>("text");
  const [currentQ, setCurrentQ] = useState(0);

  // consent
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  // mic test
  const [micTestResult, setMicTestResult] = useState<string>("");
  const [micTesting, setMicTesting] = useState(false);

  // answer
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Load session
  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSession() {
    const { data: sess } = await getSupabase()
      .from("sessions")
      .select("*")
      .eq("token", params.token)
      .single();

    if (!sess) {
      setStep("invalid");
      return;
    }
    if (sess.is_used) {
      setStep("used");
      return;
    }

    const { data: qs } = await getSupabase()
      .from("questions")
      .select("*")
      .eq("session_id", sess.id)
      .order("order_index", { ascending: true });

    // Mark session as used
    await getSupabase()
      .from("sessions")
      .update({ is_used: true })
      .eq("id", sess.id);

    setSession(sess);
    setQuestions(qs ?? []);
    setAnswers(new Array(qs?.length ?? 0).fill(""));
    setStep("consent");
  }

  // ========== Step: consent ==========
  const allConsented = consent1 && consent2;
  const stableSpeech = isSpeechApiStable();

  function handleConsentNext() {
    if (inputMethod === "voice") {
      setStep("mic-test");
    } else {
      startAnswering();
    }
  }

  function startAnswering() {
    setCurrentQ(0);
    if (questions.length > 0) {
      setTimeLeft(questions[0].time_limit_seconds);
    }
    setStep("answer");
  }

  // ========== Step: mic-test ==========
  function startMicTest() {
    if (!hasSpeechRecognition()) {
      setMicTestResult("このブラウザでは音声認識がサポートされていません");
      return;
    }
    setMicTesting(true);
    setMicTestResult("");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      setMicTestResult(text);
      setMicTesting(false);
    };
    recognition.onerror = () => {
      setMicTestResult("マイクの認識に失敗しました。マイクの許可を確認してください。");
      setMicTesting(false);
    };
    recognition.onend = () => {
      setMicTesting(false);
    };
    recognition.start();
  }

  // ========== Step: answer ==========
  const currentQuestion = questions[currentQ];

  // Timer
  useEffect(() => {
    if (step !== "answer") return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (inputMethod === "voice") {
            stopRecording();
            goNextQuestion();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentQ]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  function startRecording() {
    if (!hasSpeechRecognition()) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = answers[currentQ] || "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQ] = finalTranscript + interim;
        return next;
      });
    };

    recognition.onerror = () => {
      stopRecording();
    };
    recognition.onend = () => {
      // Save final transcript on end
      setAnswers((prev) => {
        const next = [...prev];
        if (!next[currentQ]) next[currentQ] = finalTranscript;
        return next;
      });
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function goNextQuestion() {
    stopRecording();
    if (currentQ < questions.length - 1) {
      const nextIdx = currentQ + 1;
      setCurrentQ(nextIdx);
      setTimeLeft(questions[nextIdx].time_limit_seconds);
    } else {
      setStep("confirm");
    }
  }

  function switchInputMethod() {
    stopRecording();
    setInputMethod((prev) => (prev === "voice" ? "text" : "voice"));
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ========== Step: confirm ==========
  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  // ========== Step: done (print) ==========
  function handlePrint() {
    setStep("done");
    setTimeout(() => window.print(), 300);
  }

  // ========== Rendering ==========

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">無効なURL</h1>
          <p className="text-gray-600 text-sm">
            このURLは無効です。URLをお確かめの上、再度アクセスしてください。
          </p>
        </div>
      </div>
    );
  }

  if (step === "used") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">使用済みURL</h1>
          <p className="text-gray-600 text-sm">
            このURLはすでに使用済みです。ご不明な場合は担当者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  if (step === "consent") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 max-w-lg w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            追加質問への回答
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {session?.candidate_name} 様、以下の内容にご同意の上、回答を開始してください。
          </p>

          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent1}
                onChange={(e) => setConsent1(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                回答内容は文字として記録されます
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent2}
                onChange={(e) => setConsent2(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                記録した内容はPDFとして出力し、担当エージェントに提出します
              </span>
            </label>
            <button
              onClick={() => { setConsent1(true); setConsent2(true); }}
              className="text-sm text-blue-600 hover:underline"
            >
              すべてに同意する
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              入力方法の選択
            </h2>
            {stableSpeech ? (
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-md border border-gray-200 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="inputMethod"
                    value="voice"
                    checked={inputMethod === "voice"}
                    onChange={() => setInputMethod("voice")}
                    className="h-4 w-4"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      音声入力（推奨）
                    </span>
                    <p className="text-xs text-gray-500">
                      マイクに話しかけると自動で文字起こしされます
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-md border border-gray-200 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="inputMethod"
                    value="text"
                    checked={inputMethod === "text"}
                    onChange={() => setInputMethod("text")}
                    className="h-4 w-4"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      テキスト入力
                    </span>
                    <p className="text-xs text-gray-500">
                      キーボードで直接入力します
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 mb-2">
                  このブラウザでは音声機能が不安定です。テキスト入力を推奨します。
                </p>
                <p className="text-xs text-yellow-700">
                  音声入力をご希望の場合はGoogle ChromeまたはMicrosoft Edgeをご利用ください。
                </p>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="inputMethod"
                      value="text"
                      checked={inputMethod === "text"}
                      onChange={() => setInputMethod("text")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-900">テキスト入力</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="inputMethod"
                      value="voice"
                      checked={inputMethod === "voice"}
                      onChange={() => setInputMethod("voice")}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-900">音声入力を試す</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConsentNext}
            disabled={!allConsented}
            className="w-full py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            回答を開始する
          </button>
        </div>
      </div>
    );
  }

  if (step === "mic-test") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 max-w-lg w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            マイクの動作確認
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            始める前に、マイクの動作確認をします。
            <br />
            下のボタンを押して「おはようございます」と話しかけてください。
          </p>

          <button
            onClick={startMicTest}
            disabled={micTesting}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 mb-4"
          >
            {micTesting ? "聞き取り中..." : "マイクテストを開始"}
          </button>

          {micTestResult && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">認識結果:</p>
              <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-900">
                {micTestResult}
              </div>
              <p className="text-sm text-gray-600 mt-3">
                正しく認識されましたか？
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={startAnswering}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  はい、回答を開始する
                </button>
                <button
                  onClick={startMicTest}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  再試行
                </button>
              </div>
              <button
                onClick={() => {
                  setInputMethod("text");
                  startAnswering();
                }}
                className="mt-3 text-sm text-gray-500 hover:underline w-full text-center"
              >
                テキスト入力に切り替える
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "answer" && currentQuestion) {
    const isLastQuestion = currentQ === questions.length - 1;
    const timeWarning = timeLeft <= 10 && timeLeft > 0;

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              質問 {currentQ + 1} / {questions.length}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-mono font-bold ${
                  timeWarning
                    ? "text-red-600 animate-pulse"
                    : timeLeft <= 30
                    ? "text-orange-500"
                    : "text-gray-700"
                }`}
              >
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{
                width: `${((currentQ + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Q{currentQ + 1}.
            </h2>
            <p className="text-gray-800">{currentQuestion.question_text}</p>
          </div>

          {/* Answer input */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {inputMethod === "voice" ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    音声入力
                  </span>
                  <button
                    onClick={switchInputMethod}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    テキスト入力に切り替え
                  </button>
                </div>
                <button
                  onClick={toggleRecording}
                  className={`w-full py-3 rounded-md text-sm font-medium mb-3 ${
                    isRecording
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {isRecording ? "録音停止" : "録音開始"}
                </button>
                {isRecording && (
                  <p className="text-xs text-red-500 mb-2 text-center">
                    録音中...マイクに向かって話してください
                  </p>
                )}
                <textarea
                  value={answers[currentQ]}
                  onChange={(e) => updateAnswer(currentQ, e.target.value)}
                  rows={8}
                  placeholder="音声が文字起こしされます（手動編集も可能です）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    テキスト入力
                  </span>
                  {hasSpeechRecognition() && (
                    <button
                      onClick={switchInputMethod}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      音声入力に切り替え
                    </button>
                  )}
                </div>
                <textarea
                  value={answers[currentQ]}
                  onChange={(e) => updateAnswer(currentQ, e.target.value)}
                  rows={8}
                  placeholder="回答を入力してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </>
            )}
          </div>

          {/* 10秒前警告 */}
          {timeWarning && inputMethod === "voice" && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm text-center">
              残り{timeLeft}秒です。まもなく次の質問に移ります。
            </div>
          )}

          {/* Next button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={goNextQuestion}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              {isLastQuestion ? "回答を確認する" : "次の質問へ"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-2">回答の確認</h1>
          <p className="text-sm text-gray-600 mb-6">
            回答内容をご確認ください。修正が必要な場合はテキストを直接編集できます。
          </p>

          <div className="space-y-4">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="bg-white rounded-lg border border-gray-200 p-5"
              >
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Q{i + 1}. {q.question_text}
                </p>
                <textarea
                  value={answers[i]}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  rows={4}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handlePrint}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              PDFを生成する
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <>
        {/* 印刷用コンテンツ */}
        <div className="print-content">
          <div className="max-w-2xl mx-auto p-8">
            <h1 className="text-xl font-bold mb-1">
              {session?.candidate_name} さんの追加質問回答
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              出力日時:{" "}
              {new Date().toLocaleString("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id}>
                  <p className="font-semibold text-sm">
                    Q{i + 1}. {q.question_text}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap pl-4 border-l-2 border-gray-300">
                    {answers[i] || "（未回答）"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 画面表示用（印刷時非表示） */}
        <div className="no-print min-h-screen bg-gray-50 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 text-center">
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                回答が完了しました
              </h1>
              <p className="text-sm text-gray-600 mb-6">
                ブラウザの印刷ダイアログで「PDFに保存」を選択してください。
              </p>

              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium mb-6"
              >
                もう一度PDFを生成する
              </button>

              {session?.agent_email && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md text-left">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    提出先
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    保存したPDFを以下のメールアドレスに送付してください。
                  </p>
                  <p className="text-sm font-medium text-blue-600 break-all">
                    {session.agent_email}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}

