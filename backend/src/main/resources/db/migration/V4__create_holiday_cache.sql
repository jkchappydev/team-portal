-- 공휴일 API 월별 캐시
CREATE TABLE holiday (
  id           BIGSERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  synced_at    TIMESTAMPTZ NOT NULL,
  CONSTRAINT uk_holiday_date_name UNIQUE (holiday_date, name)
);

CREATE INDEX idx_holiday_date ON holiday (holiday_date);

CREATE TABLE holiday_month_sync (
  year_month VARCHAR(7) PRIMARY KEY,
  synced_at  TIMESTAMPTZ NOT NULL
);
