package dev.jkchappy.portal.document;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, Long> {

  // 공간 안의 삭제되지 않은 문서를 최근 수정순으로 조회
  List<Document> findBySpaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(Long spaceId);

  // 삭제된 문서 (소속 공간이 살아 있는 것만) 최근 삭제순
  @Query("select d from Document d where d.deletedAt is not null "
    + "and d.spaceId in (select s.id from Space s where s.deletedAt is null) "
    + "order by d.deletedAt desc")
  List<Document> findTrashed();

  // 공간별 삭제되지 않은 문서 수
  @Query("select d.spaceId, count(d) from Document d where d.deletedAt is null "
    + "and d.spaceId in :spaceIds group by d.spaceId")
  List<Object[]> countLiveBySpaceIds(@Param("spaceIds") Collection<Long> spaceIds);

  // 제목 또는 본문 평문에 pattern(LIKE 패턴, 이스케이프 문자 \)이 포함된 문서, 삭제된 문서와 삭제된 공간 제외
  @Query(value = "select d.* from document d join space s on s.id = d.space_id "
    + "where d.deleted_at is null and s.deleted_at is null "
    + "and (d.title ilike :pattern escape '\\' or d.plain_text ilike :pattern escape '\\') "
    + "order by d.updated_at desc limit 50", nativeQuery = true)
  List<Document> search(@Param("pattern") String pattern);
}
