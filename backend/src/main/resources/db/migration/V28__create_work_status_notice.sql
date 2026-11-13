-- 근무 상황 등록·수정·삭제 알림 (팀장 이상·개발자에게 받는 사람마다 한 줄)
-- 근무 상황을 지워도 알림 내용은 남도록 표기 문자열과 날짜를 복사해 둠
CREATE TABLE work_status_notice (
  id           BIGSERIAL PRIMARY KEY,
  recipient_id BIGINT NOT NULL REFERENCES member (id) ON DELETE CASCADE,
  actor_id     BIGINT NOT NULL REFERENCES member (id) ON DELETE CASCADE,
  action       VARCHAR(10) NOT NULL,
  label        VARCHAR(300) NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  read_at      TIMESTAMPTZ
);

CREATE INDEX idx_work_status_notice_unread ON work_status_notice (recipient_id, created_at) WHERE read_at IS NULL;
