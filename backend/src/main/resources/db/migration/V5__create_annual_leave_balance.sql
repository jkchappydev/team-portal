CREATE TABLE annual_leave_balance (
  id             BIGSERIAL PRIMARY KEY,
  member_id      BIGINT NOT NULL REFERENCES member (id),
  year           INTEGER NOT NULL,
  confirmed_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  carried_days   NUMERIC(6, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  CONSTRAINT uk_annual_leave_balance_member_year UNIQUE (member_id, year),
  CONSTRAINT ck_annual_leave_balance_confirmed_days CHECK (confirmed_days >= 0),
  CONSTRAINT ck_annual_leave_balance_carried_days CHECK (carried_days >= 0)
);

CREATE INDEX idx_annual_leave_balance_year ON annual_leave_balance (year);
