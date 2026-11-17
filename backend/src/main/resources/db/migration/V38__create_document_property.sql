-- 페이지 속성: 노션처럼 제목 아래 담당자·날짜 등 (페이지마다 따로 두고, 순서는 끌어서 바꿈, 하드 삭제)
CREATE TABLE document_property (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  type        VARCHAR(20) NOT NULL,
  value       TEXT,
  sort_order  INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_document_property_document ON document_property (document_id, sort_order);

-- 기본 속성(담당자)을 이미 만들었는지 (사용자가 지운 뒤 다시 생기지 않게 처음 한 번만 만듦)
ALTER TABLE document ADD COLUMN properties_initialized BOOLEAN NOT NULL DEFAULT FALSE;
