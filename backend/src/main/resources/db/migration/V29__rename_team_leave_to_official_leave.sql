-- 팀자율연차를 공가로 바꿈 (연차에서 빼지 않는 휴가, 연차 표에는 0으로 표시)
UPDATE work_status SET type = 'OFFICIAL_LEAVE' WHERE type = 'TEAM_LEAVE';
