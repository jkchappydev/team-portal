-- 노션처럼 페이지 제목 앞에 붙는 이모지 아이콘 (NULL이면 아이콘 없음)
ALTER TABLE document ADD COLUMN icon VARCHAR(32);
