-- 사이드바 최상위 페이지의 표시 순서 (끌어다 순서 변경)
ALTER TABLE space ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

-- 기존 최상위 페이지는 지금까지 보이던 이름순을 그대로 유지
UPDATE space s
SET sort_order = ordered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name, id) - 1 AS rn
  FROM space
) ordered
WHERE s.id = ordered.id;
