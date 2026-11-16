-- 외부 연락처: 회사 밖 업체 담당자의 이메일·전화번호와 연관 프로젝트 (팀 공용, 순서는 끌어서 바꿈, 하드 삭제)
CREATE TABLE external_contact (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  company     VARCHAR(100),
  email       VARCHAR(255),
  phone       VARCHAR(20),
  sort_order  INT NOT NULL,
  created_by  BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);

-- 연락처 한 명에 연관 프로젝트 여러 개 (입력한 순서대로)
CREATE TABLE external_contact_project (
  contact_id  BIGINT NOT NULL REFERENCES external_contact(id) ON DELETE CASCADE,
  position    INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  PRIMARY KEY (contact_id, position)
);
