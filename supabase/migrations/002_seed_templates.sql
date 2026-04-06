-- 初期テンプレートデータ
insert into templates (name, questions) values
(
  '汎用（中途）',
  '[
    {"question_text": "これまでの経験で最も困難だった状況と、その時どのように対処しましたか？", "time_limit_seconds": 180},
    {"question_text": "今回の転職を考えた理由を教えてください。", "time_limit_seconds": 180},
    {"question_text": "入社後に実現したいことは何ですか？", "time_limit_seconds": 180}
  ]'::jsonb
),
(
  '営業職向け',
  '[
    {"question_text": "これまでで最も成果を出した商談について、どのように進めましたか？", "time_limit_seconds": 180},
    {"question_text": "顧客との信頼関係を構築するうえで、日頃から意識していることは何ですか？", "time_limit_seconds": 180},
    {"question_text": "目標が未達だった際、どのように振り返り、次に活かしていますか？", "time_limit_seconds": 180}
  ]'::jsonb
);
