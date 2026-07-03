-- Add attendance_logs table for multiple clock-in/clock-out sessions per day
-- The main `attendance` row still aggregates: first check_in_time, last check_out_time, total work_hours
-- The nightly scheduler reads attendance_logs to compute the final values.

CREATE TABLE IF NOT EXISTS "attendance_logs" (
    "id"            UUID        NOT NULL DEFAULT uuid_generate_v4(),
    "attendance_id" UUID        NOT NULL,
    "employee_id"   UUID        NOT NULL,
    "date"          DATE        NOT NULL,
    "type"          TEXT        NOT NULL CHECK (type IN ('clock_in', 'clock_out')),
    "logged_at"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_logs_attendance_id_idx" ON "attendance_logs"("attendance_id");
CREATE INDEX "attendance_logs_employee_id_date_idx" ON "attendance_logs"("employee_id", "date");

ALTER TABLE "attendance_logs"
    ADD CONSTRAINT "attendance_logs_attendance_id_fkey"
    FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_logs"
    ADD CONSTRAINT "attendance_logs_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
