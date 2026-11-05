package dev.jkchappy.portal.space;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpaceRepository extends JpaRepository<Space, Long> {

  // 삭제되지 않은 최상위 페이지를 사이드바 표시 순서로 조회 (같은 순서면 이름순)
  List<Space> findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc();

  List<Space> findByDeletedAtIsNotNullOrderByDeletedAtDesc();
}
