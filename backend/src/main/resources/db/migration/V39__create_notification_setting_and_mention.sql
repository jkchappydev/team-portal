-- 팀원별 프로젝트(최상위 페이지 포함) 알림 받기 설정, 행이 없으면 모든 게시글(ALL)
CREATE TABLE notification_setting (
  member_id BIGINT      NOT NULL REFERENCES member (id) ON DELETE CASCADE,
  space_id  BIGINT      NOT NULL REFERENCES space (id) ON DELETE CASCADE,
  level     VARCHAR(10) NOT NULL CHECK (level IN ('ALL', 'MENTION', 'OFF')),
  PRIMARY KEY (member_id, space_id)
);

-- 본문에서 @로 언급된 팀원 (본문 저장 때마다 지금 본문 기준으로 맞춤)
-- mentioned_at 이후에 그 팀원이 페이지를 확인하지 않았으면 담당 언급 알림
CREATE TABLE document_mention (
  document_id  BIGINT      NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  member_id    BIGINT      NOT NULL REFERENCES member (id) ON DELETE CASCADE,
  mentioned_by BIGINT      REFERENCES member (id) ON DELETE SET NULL,
  mentioned_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (document_id, member_id)
);
CREATE INDEX idx_document_mention_member ON document_mention (member_id);
