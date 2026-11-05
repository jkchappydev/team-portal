-- 기존 반반차 시간대를 오전/오후로 변환하고 시간 값 제거
UPDATE work_status
SET half_day_period = CASE
      WHEN start_time IS NOT NULL AND start_time < TIME '12:00' THEN 'AM'
      ELSE 'PM'
    END,
    start_time = NULL,
    end_time = NULL
WHERE type = 'QUARTER_DAY';
