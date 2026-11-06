package dev.jkchappy.portal.space;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpaceRepository extends JpaRepository<Space, Long> {

  // 영구 삭제 전 본문 페이지 참조 해제
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("update Space s set s.homeDocumentId = null where s.id = :id")
  void clearHomeDocument(@Param("id") Long id);

  // 최상위 페이지 행 삭제
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("delete from Space s where s.id = :id")
  void deleteRow(@Param("id") Long id);

  // 삭제되지 않은 최상위 페이지를 사이드바 표시 순서로 조회 (같은 순서면 이름순)
  List<Space> findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc();

  List<Space> findByDeletedAtIsNotNullOrderByDeletedAtDesc();
}
