"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";

interface JobQuestion {
  id: string;
  job_id: string;
  order_index: number;
  question_text: string;
  time_limit_seconds: number;
}

type InputMethod = "voice" | "text";
type Step = "loading" | "invalid" | "used" | "consent" | "mic-test" | "answer" | "confirm" | "done";

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
  params: { jobId: string };
}

export default function ApplyPage({ params }: Props) {
  const [step, setStep] = useState<Step>("loading");
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [inputMethod, setInputMethod] = useState<InputMethod>("text");
  const [currentQ, setCurrentQ] = useState(0);

  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);

  const [micTestResult, setMicTestResult] = useState<string>("");
  const [micTesting, setMicTesting] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const localStorageKey = `job_completed_${params.jobId}`;

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadJob() {
    // localStorageで回答済みチェック
    if (typeof window !== "undefined" && localStorage.getItem(localStorageKey)) {
      setStep("used");
      return;
    }

    const { data: job } = await getSupabase()
      .from("job_postings")
      .select("id, is_active")
      .eq("id", params.jobId)
      .single();

    if (!job || !(job as { is_active: boolean }).is_active) {
      setStep("invalid");
      return;
    }

    const { data: qs } = await getSupabase()
      .from("job_questions")
      .select("*")
      .eq("job_id", params.jobId)
      .order("order_index", { ascending: true });

    setQuestions((qs ?? []) as JobQuestion[]);
    setAnswers(new Array(qs?.length ?? 0).fill(""));
    setStep("consent");
  }

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
      setMicTestResult(event.results[0][0].transcript);
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

  const currentQuestion = questions[currentQ];

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

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handlePrint() {
    // 回答済みフラグをlocalStorageに保存
    if (typeof window !== "undefined") {
      localStorage.setItem(localStorageKey, new Date().toISOString());
    }
    setStep("done");
    setTimeout(() => window.print(), 300);
  }

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
            このURLは無効または受付を終了しています。担当エージェントにお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  if (step === "used") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">回答済み</h1>
          <p className="text-gray-600 text-sm">
            このURLへの回答は既に完了しています。
          </p>
        </div>
      </div>
    );
  }

  if (step === "consent") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 max-w-lg w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-1">追加質問への回答</h1>
          <p className="text-sm text-gray-600 mb-6">
            選考書類を提出していただきまして、誠にありがとうございます。
            選考の際に追加でご質問にご回答いただきたいと考えております。
            以下の内容にご同意の上、回答を開始してください。
          </p>

          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent1}
                onChange={(e) => setConsent1(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">回答内容は文字として記録されます</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent2}
                onChange={(e) => setConsent2(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                記録した内容はPDFとして出力し、担当エージェントにご自身でご提出いただきます
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
            <h2 className="text-sm font-semibold text-gray-900 mb-2">入力方法の選択</h2>
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
                    <span className="text-sm font-medium text-gray-900">音声入力（推奨）</span>
                    <p className="text-xs text-gray-500">マイクに話しかけると自動で文字起こしされます</p>
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
                    <span className="text-sm font-medium text-gray-900">テキスト入力</span>
                    <p className="text-xs text-gray-500">キーボードで直接入力します</p>
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

          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs text-amber-800">
              この回答は1度限りです。PDFを生成すると再回答できなくなります。落ち着いて回答してください。
            </p>
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
          <h1 className="text-xl font-bold text-gray-900 mb-2">マイクの動作確認</h1>
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
              <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-900">{micTestResult}</div>
              <p className="text-sm text-gray-600 mt-3">正しく認識されましたか？</p>
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
                onClick={() => { setInputMethod("text"); startAnswering(); }}
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
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              質問 {currentQ + 1} / {questions.length}
            </span>
            <div
              className={`px-4 py-2 rounded-lg font-mono font-bold text-3xl min-w-[5rem] text-center ${
                timeWarning
                  ? "bg-red-100 text-red-600 animate-pulse"
                  : timeLeft <= 30
                  ? "bg-orange-100 text-orange-600"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Q{currentQ + 1}.</h2>
            <p className="text-gray-800">{currentQuestion.question_text}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {inputMethod === "voice" ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">音声入力</span>
                  <button onClick={switchInputMethod} className="text-xs text-blue-600 hover:underline">
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
                  <span className="text-sm font-medium text-gray-700">テキスト入力</span>
                  {hasSpeechRecognition() && (
                    <button onClick={switchInputMethod} className="text-xs text-blue-600 hover:underline">
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

          {timeWarning && inputMethod === "voice" && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm text-center">
              残り{timeLeft}秒です。まもなく次の質問に移ります。
            </div>
          )}

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
          <p className="text-sm text-gray-600 mb-2">
            回答内容をご確認ください。修正が必要な場合はテキストを直接編集できます。
          </p>
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs text-amber-800">
              「PDFを生成する」を押すと再回答できなくなります。内容をよくご確認の上、生成してください。
            </p>
          </div>

          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="bg-white rounded-lg border border-gray-200 p-5">
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
        <div className="print-content">
          <div className="max-w-2xl mx-auto p-8">
            <h1 className="text-xl font-bold mb-1">追加質問回答</h1>
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
                  <p className="font-semibold text-sm">Q{i + 1}. {q.question_text}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap pl-4 border-l-2 border-gray-300">
                    {answers[i] || "（未回答）"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="no-print min-h-screen bg-gray-50 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 text-center">
              <h1 className="text-xl font-bold text-gray-900 mb-2">回答が完了しました</h1>
              <p className="text-sm text-gray-600 mb-6">
                ブラウザの印刷ダイアログで「PDFに保存」を選択してください。
              </p>
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium mb-6"
              >
                もう一度PDFを生成する
              </button>
              <div className="mt-4 p-4 bg-gray-50 rounded-md text-left">
                <p className="text-sm text-gray-700">
                  保存したPDFを担当エージェントへメールにてお送りください。
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
