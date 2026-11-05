-- 팀원별 페이지 마지막 확인 시각 (다른 사람이 그 뒤에 수정하면 수정 알림에 표시)
CREATE TABLE document_read (
  member_id   BIGINT NOT NULL REFERENCES member (id),
  document_id BIGINT NOT NULL REFERENCES document (id),
  read_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (member_id, document_id)
);
