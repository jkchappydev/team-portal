-- 외부 연락처 카드의 이름 첫 글자 동그라미 색 (#RRGGBB, 비어 있으면 화면에서 자동 색)
ALTER TABLE external_contact ADD COLUMN color VARCHAR(7);
