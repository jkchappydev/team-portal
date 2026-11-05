-- 팀원 삭제는 행을 지우지 않고 삭제일만 기록 (작성 문서·근무 상황·연차 기록과 이름 표시 유지)
ALTER TABLE member ADD COLUMN deleted_on date;
