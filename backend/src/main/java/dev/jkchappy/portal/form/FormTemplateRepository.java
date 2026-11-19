package dev.jkchappy.portal.form;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FormTemplateRepository extends JpaRepository<FormTemplate, Long> {

  // 보관함 목록: 휴지통에 없는 파일을 화면 표시 순서로 조회 (같은 순서면 먼저 올린 것부터)
  List<FormTemplate> findByDeletedAtIsNullOrderBySortOrderAscIdAsc();

  // 휴지통: 삭제한 파일을 최근 삭제순으로 조회
  List<FormTemplate> findByDeletedAtIsNotNullOrderByDeletedAtDesc();
}
