# Additional Questions

## プロジェクト概要
企業が候補者に追加質問を送り、候補者が音声またはテキストで回答してPDFを生成・提出するWebアプリ。

## 技術スタック
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase（セッション・質問管理DB）
- Vercel（デプロイ先）

## インフラ・ツール

### Supabase
- **Supabase CLI** がインストール済み（Scoop経由）
- コマンドパス: `~/scoop/shims/supabase.exe`
- プロジェクトref: `jugklwfquqakqlgpjend`
- プロジェクトリンク済み・ログイン済み

マイグレーション適用:
```bash
~/scoop/shims/supabase.exe db push --workdir "C:/Users/kuroi/OneDrive/デスクトップ/Myextensions/claude/additional-questions"
```

新しいマイグレーションは `supabase/migrations/` に連番で追加（例: `005_xxxx.sql`）。

### Vercel
- デプロイ先はVercel
- 環境変数はVercel Settings → Environment Variables で管理

## 開発ルール
- マイグレーションファイルを作成したら必ず `supabase db push` で適用する
- デプロイエラーは `npm run build` でまず確認する
