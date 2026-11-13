package dev.jkchappy.portal.link;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SidebarLinkRepository extends JpaRepository<SidebarLink, Long> {

  // 사이드바 표시 순서로 조회 (같은 순서면 먼저 만든 것부터)
  List<SidebarLink> findAllByOrderBySortOrderAscIdAsc();
}
