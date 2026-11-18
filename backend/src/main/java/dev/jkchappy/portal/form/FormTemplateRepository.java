package dev.jkchappy.portal.form;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FormTemplateRepository extends JpaRepository<FormTemplate, Long> {

  // 화면 표시 순서로 조회 (같은 순서면 먼저 올린 것부터)
  List<FormTemplate> findAllByOrderBySortOrderAscIdAsc();
}
