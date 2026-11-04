-- 팀 포털 초기 스키마 (이후 Task에서 테이블을 추가한다)

-- 팀원 (로그인 없이 이름 선택으로 식별, 삭제 대신 비활성화)
CREATE TABLE member (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);


-- 근무 상황 (연차/반차/조퇴/출장/외근/기타)
CREATE TABLE work_status (
  id              BIGSERIAL PRIMARY KEY,
  member_id       BIGINT NOT NULL REFERENCES member (id),
  type            VARCHAR(20) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  half_day_period VARCHAR(2),
  start_time      TIME,
  end_time        TIME,
  place           VARCHAR(100),
  content         VARCHAR(100),
  created_by      BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_work_status_period ON work_status (start_date, end_date);


-- 문서 공간 (소프트 삭제)
CREATE TABLE space (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_by  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  deleted_at  TIMESTAMPTZ
);

-- 문서 (본문 상태와 검색용 평문은 Task 5에서 기록, 소프트 삭제)
CREATE TABLE document (
  id            BIGSERIAL PRIMARY KEY,
  space_id      BIGINT NOT NULL REFERENCES space (id),
  title         VARCHAR(200) NOT NULL DEFAULT '제목 없음',
  content_state BYTEA,
  plain_text    TEXT NOT NULL DEFAULT '',
  created_by    BIGINT NOT NULL,
  updated_by    BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_document_space_updated ON document (space_id, updated_at DESC);

-- 문서 본문 스냅샷 (복원은 DB 직접 작업, 보관 개수 제한 없음)
CREATE TABLE document_snapshot (
  id            BIGSERIAL PRIMARY KEY,
  document_id   BIGINT NOT NULL REFERENCES document (id),
  content_state BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_document_snapshot_document_created ON document_snapshot (document_id, created_at DESC);

-- 문서 첨부파일 (DB 행과 파일 모두 하드 삭제, inline은 편집기 본문 이미지)
CREATE TABLE attachment (
  id            BIGSERIAL PRIMARY KEY,
  document_id   BIGINT NOT NULL REFERENCES document (id),
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(64) NOT NULL UNIQUE,
  content_type  VARCHAR(150) NOT NULL,
  size          BIGINT NOT NULL,
  inline        BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by   BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_attachment_document_created ON attachment (document_id, created_at DESC);
