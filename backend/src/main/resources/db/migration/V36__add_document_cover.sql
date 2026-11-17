-- 프로젝트 커버 이미지 (att:{첨부 ID} 또는 https 주소, NULL이면 없음)
ALTER TABLE document ADD COLUMN cover VARCHAR(512);
