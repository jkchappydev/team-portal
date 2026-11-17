package dev.jkchappy.portal.document;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, Long> {

  // 기본 속성을 아직 만들지 않은 페이지만 표시를 바꿈 (바꾼 행 수가 1일 때만 기본 속성을 만들어 동시 요청에도 한 번만)
  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query("update Document d set d.propertiesInitialized = true where d.id = :id and d.propertiesInitialized = false")
  int markPropertiesInitialized(@Param("id") Long id);

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
    + "and d.kind <> dev.jkchappy.portal.document.DocumentKind.WBS "
    + "group by d.spaceId")
  List<Object[]> countLiveBySpaceIds(@Param("spaceIds") Collection<Long> spaceIds);

  // 제목, 본문 평문 또는 본문에 넣은 일정(바로 아래 WBS)의 작업명에 pattern(LIKE 패턴, 이스케이프 문자 \)이 포함된 페이지
  // WBS 항목 자체와 삭제된 문서·삭제된 공간 제외
  @Query(value = "select d.* from document d join space s on s.id = d.space_id "
    + "where d.deleted_at is null and s.deleted_at is null and d.kind <> 'WBS' "
    + "and (d.title ilike :pattern escape '\\' or d.plain_text ilike :pattern escape '\\' "
    + "or exists (select 1 from document w join wbs_task t on t.document_id = w.id "
    + "where w.parent_id = d.id and w.kind = 'WBS' and w.deleted_at is null "
    + "and t.name ilike :pattern escape '\\')) "
    + "order by d.updated_at desc limit 50", nativeQuery = true)
  List<Document> search(@Param("pattern") String pattern);

  // memberId가 아직 확인하지 않은 알림 대상 문서, 최근순 (본문 블록 저장소인 WBS 항목 제외)
  // 프로젝트 알림 설정(없으면 ALL)에 따라 ALL은 since 이후 다른 사람의 수정, ALL·MENTION은 since 이후 다른 사람의 @언급
  // OFF인 프로젝트는 모두 제외
  @Query(value = "select d.* from document d join space s on s.id = d.space_id "
    + "left join document_read r on r.document_id = d.id and r.member_id = :memberId "
    + "left join notification_setting ns on ns.space_id = d.space_id and ns.member_id = :memberId "
    + "left join document_mention m on m.document_id = d.id and m.member_id = :memberId "
    + "and m.mentioned_by <> :memberId and m.mentioned_at > :since "
    + "and (r.read_at is null or r.read_at < m.mentioned_at) "
    + "where d.deleted_at is null and s.deleted_at is null and d.kind <> 'WBS' "
    + "and coalesce(ns.level, 'ALL') <> 'OFF' "
    + "and ((coalesce(ns.level, 'ALL') = 'ALL' and d.updated_by <> :memberId and d.updated_at > :since "
    + "and (r.read_at is null or r.read_at < d.updated_at)) or m.member_id is not null) "
    + "order by greatest(d.updated_at, m.mentioned_at) desc limit :limit", nativeQuery = true)
  List<Document> findUnreadUpdates(@Param("memberId") Long memberId, @Param("since") Instant since,
    @Param("limit") int limit);

  // 최근에 만든 페이지·파일 (메인 화면 새 게시글), 만든 시각 최신순 (WBS 항목·삭제된 문서·삭제된 공간 제외)
  @Query(value = "select d.* from document d join space s on s.id = d.space_id "
    + "where d.deleted_at is null and s.deleted_at is null and d.kind <> 'WBS' "
    + "order by d.created_at desc, d.id desc limit :limit", nativeQuery = true)
  List<Document> findRecentlyCreated(@Param("limit") int limit);

  // 기존 하위 항목을 본문에 페이지 블록으로 붙일 대상에서 이 문서를 빼고 뺀 행 수를 돌려줌 (1이면 처음 가져감)
  // 동시에 두 번 불려도 한 쪽만 1을 받음
  @Modifying
  @Query(value = "delete from page_block_backfill where document_id = :id", nativeQuery = true)
  int claimPageBlockBackfill(@Param("id") Long id);
}
