-- 팀 스페이스 "양식" 메뉴에 올려 두고 미리보기·내려받는 문서 양식 파일 (파일 본체는 FileStorage, 하드 삭제)
CREATE TABLE form_template (
  id            BIGSERIAL PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(64) NOT NULL UNIQUE,
  content_type  VARCHAR(150) NOT NULL,
  size          BIGINT NOT NULL,
  sort_order    INT NOT NULL,
  uploaded_by   BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);
