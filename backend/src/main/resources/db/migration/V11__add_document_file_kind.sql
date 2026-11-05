-- 사이드바 트리에 끌어다 놓은 파일도 페이지처럼 한 항목으로 관리 (PAGE: 페이지, FILE: 파일)
ALTER TABLE document ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'PAGE';

-- 파일 항목의 파일 본체 (FILE일 때만 값이 있음)
ALTER TABLE document ADD COLUMN attachment_id BIGINT REFERENCES attachment (id);

-- 사이드바 "양식" 칸은 트리 안의 파일 항목으로 대체 (제거 시점에 저장된 양식 없음)
DROP TABLE form_template;
