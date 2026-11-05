-- 조퇴 종류 폐지, 반반차로 대체 (기존 조퇴 데이터는 반반차로 변환)
UPDATE work_status SET type = 'QUARTER_DAY' WHERE type = 'EARLY_LEAVE';
