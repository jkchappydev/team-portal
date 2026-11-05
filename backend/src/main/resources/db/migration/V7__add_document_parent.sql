-- 노션처럼 페이지 안의 하위 페이지 (NULL이면 프로젝트 최상위)
ALTER TABLE document ADD COLUMN parent_id BIGINT REFERENCES document (id);

CREATE INDEX idx_document_parent ON document (parent_id);
