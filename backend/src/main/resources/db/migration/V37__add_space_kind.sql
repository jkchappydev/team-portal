-- 사이드바 최상위 항목 종류: PROJECT(메인 화면 갤러리에 보임) 또는 PAGE(그냥 페이지)
ALTER TABLE space ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'PROJECT';
