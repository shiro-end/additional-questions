-- セッションテーブル: 候補者ごとの回答セッションを管理
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  candidate_name text not null,
  candidate_email text not null,
  is_used boolean not null default false,
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone
);

-- 質問テーブル: セッションに紐づく個別の質問
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  order_index integer not null,
  question_text text not null,
  time_limit_seconds integer not null default 180
);

-- テンプレートテーブル: 質問セットの再利用用
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now()
);

-- インデックス
create index if not exists idx_sessions_token on sessions(token);
create index if not exists idx_questions_session_id on questions(session_id);
