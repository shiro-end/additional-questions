-- エージェントメールアドレスカラムを追加（PDF送付先）
alter table sessions add column agent_email text not null default '';
