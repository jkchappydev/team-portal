-- 공유 보관함 파일 삭제는 휴지통으로 이동 (삭제 시각만 기록, 휴지통 영구 삭제 때 행과 파일 본체 삭제)
ALTER TABLE form_template ADD COLUMN deleted_at TIMESTAMPTZ;
