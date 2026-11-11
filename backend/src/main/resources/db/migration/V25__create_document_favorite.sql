-- 팀원별 즐겨찾는 페이지 (순서는 본인이 끌어서 바꿈)
-- 페이지를 영구 삭제하거나 팀원을 지우면 즐겨찾기도 함께 지움
CREATE TABLE document_favorite (
  member_id   BIGINT NOT NULL REFERENCES member (id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  sort_order  INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (member_id, document_id)
);
