package dev.jkchappy.portal.contact;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExternalContactRepository extends JpaRepository<ExternalContact, Long> {

  // 목록 표시 순서로 조회 (같은 순서면 먼저 만든 것부터)
  List<ExternalContact> findAllByOrderBySortOrderAscIdAsc();
}
