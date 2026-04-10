-- 担当エージェント機能廃止に伴い agent_email カラムを削除
alter table sessions drop column if exists agent_email;
