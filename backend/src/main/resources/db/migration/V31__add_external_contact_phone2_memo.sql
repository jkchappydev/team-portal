-- 외부 연락처에 두 번째 전화번호와 메모 추가 (기존 phone은 전화번호 1)
ALTER TABLE external_contact ADD COLUMN phone2 VARCHAR(20);
ALTER TABLE external_contact ADD COLUMN memo VARCHAR(1000);
