ALTER TABLE member ADD COLUMN admin boolean NOT NULL DEFAULT false;

CREATE TABLE account (
  id bigserial PRIMARY KEY,
  google_subject varchar(255) NOT NULL UNIQUE,
  email varchar(320) NOT NULL UNIQUE,
  google_name varchar(100) NOT NULL,
  status varchar(20) NOT NULL,
  member_id bigint UNIQUE REFERENCES member(id),
  requested_at timestamptz NOT NULL,
  decided_at timestamptz,
  decided_by bigint REFERENCES member(id)
);
