-- 수정 이력 화면용: 사본을 만든 저장의 수정자와 사본 종류 (AUTO: 10분 간격 자동, BEFORE_RESTORE: 되돌리기 직전 본문)
ALTER TABLE document_snapshot ADD COLUMN created_by BIGINT REFERENCES member (id);
ALTER TABLE document_snapshot ADD COLUMN reason VARCHAR(20) NOT NULL DEFAULT 'AUTO';
