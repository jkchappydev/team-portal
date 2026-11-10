-- 개발자 권한 (루트 관리자 성격): 화면·API로 줄 수 없고 DB에서만 지정
ALTER TABLE member ADD COLUMN developer boolean NOT NULL DEFAULT false;
