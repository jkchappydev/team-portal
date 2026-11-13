-- 사이드바 "링크"에 팀이 함께 쓰는 외부 주소 (순서는 끌어서 바꿈, 하드 삭제)
CREATE TABLE sidebar_link (
  id          BIGSERIAL PRIMARY KEY,
  title       VARCHAR(100) NOT NULL,
  url         VARCHAR(2000) NOT NULL,
  sort_order  INT NOT NULL,
  created_by  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
