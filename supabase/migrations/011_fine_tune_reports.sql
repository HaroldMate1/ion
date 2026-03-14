-- Fine-Tune Daily Reports
-- Mirrors coach_daily_report but for the Fine-Tune pharma portfolio
create table if not exists fine_tune_report (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  report_date   date not null,
  metrics_json  jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  unique(user_id, report_date)
);

-- RLS
alter table fine_tune_report enable row level security;

create policy "Users can view own fine-tune reports"
  on fine_tune_report for select
  using (auth.uid() = user_id);

create policy "Users can insert own fine-tune reports"
  on fine_tune_report for insert
  with check (auth.uid() = user_id);

-- Service-role insert (for cron job)
create policy "Service can insert fine-tune reports"
  on fine_tune_report for insert
  with check (true);
