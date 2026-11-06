-- WBS 작업 (document.kind = 'WBS' 항목 안의 작업 트리, 문서를 영구 삭제하면 함께 삭제)
CREATE TABLE wbs_task (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  parent_id   BIGINT REFERENCES wbs_task (id) ON DELETE CASCADE,
  sort_order  INT NOT NULL,
  name        VARCHAR(200) NOT NULL,
  start_date  DATE,
  end_date    DATE,
  progress    NUMERIC(4, 1) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by  BIGINT NOT NULL,
  updated_by  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE INDEX idx_wbs_task_document ON wbs_task (document_id);

-- WBS 작업 담당자 (여러 명, 작업을 지우면 함께 삭제)
CREATE TABLE wbs_task_assignee (
  task_id   BIGINT NOT NULL REFERENCES wbs_task (id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES member (id),
  PRIMARY KEY (task_id, member_id)
);
