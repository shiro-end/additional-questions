-- 求人テーブル: 共通URLで使う求人単位の質問セットを管理
create table if not exists job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- 求人の質問テーブル
create table if not exists job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references job_postings(id) on delete cascade,
  order_index integer not null,
  question_text text not null,
  time_limit_seconds integer not null default 180
);

create index if not exists idx_job_questions_job_id on job_questions(job_id);
