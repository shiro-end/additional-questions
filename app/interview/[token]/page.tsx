interface Props {
  params: { token: string };
}

export default function InterviewPage({ params }: Props) {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">追加質問回答</h1>
      <p className="mt-4 text-gray-600">トークン: {params.token}</p>
    </div>
  );
}
