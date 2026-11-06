-- 페이지 아이콘에 업로드 이미지(att:{id})와 https 이미지 주소도 저장
ALTER TABLE document ALTER COLUMN icon TYPE varchar(512);
