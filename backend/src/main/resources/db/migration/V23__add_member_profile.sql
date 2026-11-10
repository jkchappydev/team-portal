-- 팀원이 직접 고르는 프로필 색(#rrggbb, 없으면 자동 색)과 프로필 이미지(저장 파일 이름·형식)
ALTER TABLE member ADD COLUMN profile_color varchar(7);
ALTER TABLE member ADD COLUMN profile_image varchar(36);
ALTER TABLE member ADD COLUMN profile_image_type varchar(50);
