-- 연관 프로젝트는 정해진 이름이 없어 태그 목록 대신 자유 입력 글 한 칸으로 저장
ALTER TABLE external_contact ADD COLUMN project VARCHAR(500);

-- 기존 태그는 입력 순서대로 쉼표로 이어 붙여 옮김
UPDATE external_contact c
SET project = p.joined
FROM (
  SELECT contact_id, string_agg(name, ', ' ORDER BY position) AS joined
  FROM external_contact_project
  GROUP BY contact_id
) p
WHERE p.contact_id = c.id;

DROP TABLE external_contact_project;
