-- 같은 상위 페이지 안에서의 표시 순서 (사이드바에서 끌어다 순서 변경)
ALTER TABLE document ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

-- 기존 페이지는 지금까지 보이던 순서(만든 순서)를 그대로 유지
UPDATE document d
SET sort_order = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY space_id, parent_id ORDER BY created_at, id) - 1 AS rn
  FROM document
) ordered
WHERE d.id = ordered.id;
