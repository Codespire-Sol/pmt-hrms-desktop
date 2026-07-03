-- Performance indexes for timesheet history and summary queries
CREATE INDEX IF NOT EXISTS time_logs_issue_id_work_date_idx
  ON time_logs (issue_id, work_date);

CREATE INDEX IF NOT EXISTS time_logs_user_id_issue_id_work_date_idx
  ON time_logs (user_id, issue_id, work_date);
