-- 사이드바 최상위 항목 구분: INTERNAL(내부 프로젝트) 또는 EXTERNAL(외부 프로젝트), 기존 항목은 모두 내부
ALTER TABLE space ADD COLUMN section VARCHAR(10) NOT NULL DEFAULT 'INTERNAL';
