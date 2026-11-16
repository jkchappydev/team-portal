-- 하위 페이지 트리를 본문 /페이지 블록으로 바꾸면서, 기존 하위 항목을 상위 본문 맨 아래에 한 번만 붙이기 위한 대상 목록
-- 본문을 처음 여는 사람이 가져가면(행 삭제) 그 뒤로는 다시 붙이지 않음
CREATE TABLE page_block_backfill (
  document_id BIGINT PRIMARY KEY REFERENCES document(id) ON DELETE CASCADE
);

-- 살아 있는 PAGE·FILE 하위 항목이 있는 페이지
INSERT INTO page_block_backfill (document_id)
SELECT DISTINCT c.parent_id
FROM document c
JOIN document p ON p.id = c.parent_id
WHERE c.parent_id IS NOT NULL
  AND c.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND c.kind IN ('PAGE', 'FILE')
ON CONFLICT DO NOTHING;

-- 프로젝트 최상위에 살아 있는 PAGE·FILE 항목이 있으면 그 프로젝트 본문(home)
INSERT INTO page_block_backfill (document_id)
SELECT s.home_document_id
FROM space s
WHERE s.deleted_at IS NULL
  AND s.home_document_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM document d
    WHERE d.space_id = s.id
      AND d.parent_id IS NULL
      AND d.id <> s.home_document_id
      AND d.deleted_at IS NULL
      AND d.kind IN ('PAGE', 'FILE')
  )
ON CONFLICT DO NOTHING;
