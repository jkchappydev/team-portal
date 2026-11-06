package dev.jkchappy.portal.document;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, Long> {

  // 최상위 페이지 안의 모든 페이지 (삭제 여부 무관, 영구 삭제 대상 수집용)
  List<Document> findBySpaceId(Long spaceId);

  // 영구 삭제 전 파일 항목과 첨부 사이의 상호 참조 해제
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("update Document d set d.attachmentId = null where d.id in :ids")
  void clearAttachmentIds(@Param("ids") Collection<Long> ids);

  // 페이지 일괄 삭제 (같은 문장 안의 상위·하위 참조는 문장 끝에서 검사)
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("delete from Document d where d.id in :ids")
  void deleteByIds(@Param("ids") Collection<Long> ids);

  // 프로젝트 안의 삭제되지 않은 페이지를 표시 순서로 조회 (같은 순서면 먼저 만든 페이지가 위)
  List<Document> findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(Long spaceId);

  // 삭제된 문서 (소속 공간이 살아 있는 것만) 최근 삭제순
  @Query("select d from Document d where d.deletedAt is not null "
    + "and d.spaceId in (select s.id from Space s where s.deletedAt is null) "
    + "order by d.deletedAt desc")
  List<Document> findTrashed();

  // 공간별 삭제되지 않은 하위 페이지 수 (프로젝트 본문 페이지 제외)
  @Query("select d.spaceId, count(d) from Document d where d.deletedAt is null "
    + "and d.spaceId in :spaceIds "
    + "and not exists (select 1 from Space s where s.homeDocumentId = d.id) "
    + "group by d.spaceId")
  List<Object[]> countLiveBySpaceIds(@Param("spaceIds") Collection<Long> spaceIds);

  // 제목 또는 본문 평문에 pattern(LIKE 패턴, 이스케이프 문자 \)이 포함된 문서, 삭제된 문서와 삭제된 공간 제외
  @Query(value = "select d.* from document d join space s on s.id = d.space_id "
    + "where d.deleted_at is null and s.deleted_at is null "
    + "and (d.title ilike :pattern escape '\\' or d.plain_text ilike :pattern escape '\\') "
    + "order by d.updated_at desc limit 50", nativeQuery = true)
  List<Document> search(@Param("pattern") String pattern);

  // since 이후 다른 사람이 수정했고 memberId가 그 뒤로 확인하지 않은 문서, 최근 수정순
  @Query(value = "select d.* from document d join space s on s.id = d.space_id "
    + "left join document_read r on r.document_id = d.id and r.member_id = :memberId "
    + "where d.deleted_at is null and s.deleted_at is null "
    + "and d.updated_by <> :memberId and d.updated_at > :since "
    + "and (r.read_at is null or r.read_at < d.updated_at) "
    + "order by d.updated_at desc limit :limit", nativeQuery = true)
  List<Document> findUnreadUpdates(@Param("memberId") Long memberId, @Param("since") Instant since,
    @Param("limit") int limit);
}
