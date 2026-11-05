-- 프로젝트(공간)마다 노션처럼 바로 쓰는 본문 페이지 연결
ALTER TABLE space ADD COLUMN home_document_id BIGINT REFERENCES document (id);

-- 기존 프로젝트에 같은 이름의 빈 본문 페이지를 만들어 연결
WITH inserted AS (
  INSERT INTO document (space_id, title, plain_text, created_by, updated_by, created_at, updated_at)
  SELECT id, name, '', created_by, created_by, now(), now()
  FROM space
  WHERE home_document_id IS NULL
  RETURNING id, space_id
)
UPDATE space s
SET home_document_id = i.id
FROM inserted i
WHERE s.id = i.space_id;
