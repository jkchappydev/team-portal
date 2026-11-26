package dev.jkchappy.portal.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

  @Mock
  private DocumentRepository documentRepository;

  @Mock
  private SpaceRepository spaceRepository;

  @Mock
  private MemberService memberService;

  @Mock
  private DocumentSnapshotRepository snapshotRepository;

  @Mock
  private dev.jkchappy.portal.attachment.AttachmentRepository attachmentRepository;

  private DocumentService service() {
    return new DocumentService(documentRepository, spaceRepository, memberService,
      snapshotRepository, attachmentRepository, Clock.systemUTC());
  }

  private Space space(Long id) {
    Space space = Space.create("개발", null, 1L);
    ReflectionTestUtils.setField(space, "id", id);
    return space;
  }

  private Document document(Long id, Long spaceId) {
    Document doc = Document.create(spaceId, "문서", 1L);
    ReflectionTestUtils.setField(doc, "id", id);
    return doc;
  }

  private Document child(Long id, Long spaceId, Long parentId, Document base) {
    ReflectionTestUtils.setField(base, "id", id);
    base.placeUnder(parentId);
    return base;
  }

  // 페이지 블록 자동 삽입: 처음 가져갈 때만 하위 PAGE·FILE ID를 표시 순서대로 (WBS 제외), 이후에는 빈 목록
  @Test
  void claimPageBlockBackfill_returnsChildrenOnce() {
    Space space = space(10L);
    Document page = document(5L, 10L);
    Document wbs = child(13L, 10L, 5L, Document.createWbs(10L, "일정", 1L));
    List<Document> live = List.of(page,
      child(11L, 10L, 5L, Document.create(10L, "첫째", 1L)),
      wbs,
      child(12L, 10L, 5L, Document.createFile(10L, "a.pdf", 1L)),
      child(14L, 10L, 99L, Document.create(10L, "다른 상위", 1L)));
    when(documentRepository.findById(5L)).thenReturn(Optional.of(page));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.claimPageBlockBackfill(5L)).thenReturn(1, 0);
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L)).thenReturn(live);

    assertThat(service().claimPageBlockBackfill(5L)).containsExactly(11L, 12L);
    assertThat(service().claimPageBlockBackfill(5L)).isEmpty();
  }

  // 프로젝트 본문(home)에서 가져가면 본문 자신을 뺀 프로젝트 최상위 항목
  @Test
  void claimPageBlockBackfill_home_returnsTopLevelWithoutHome() {
    Space space = space(10L);
    Document home = document(1L, 10L);
    space.assignHomeDocument(1L);
    Document top = document(2L, 10L);
    Document nested = child(3L, 10L, 2L, Document.create(10L, "하위", 1L));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(home));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.claimPageBlockBackfill(1L)).thenReturn(1);
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(home, top, nested));

    assertThat(service().claimPageBlockBackfill(1L)).containsExactly(2L);
  }

  // 페이지 블록 복제: 같은 상위의 맨 아래에 제목 "(사본)"·아이콘·본문을 복사한 새 페이지 생성
  @Test
  void duplicate_copiesTitleIconAndContentUnderSameParent() {
    Space space = space(10L);
    Document source = child(5L, 10L, 3L, Document.create(10L, "회의록", 2L));
    source.changeIcon("📘", 2L);
    source.updateContent(new byte[] {1, 2, 3}, "본문 내용", 2L);
    source.changeSortOrder(0);
    Document sibling = child(6L, 10L, 3L, Document.create(10L, "다른 페이지", 2L));
    sibling.changeSortOrder(4);
    Document parent = document(3L, 10L);
    when(documentRepository.findById(5L)).thenReturn(Optional.of(source));
    when(documentRepository.findById(3L)).thenReturn(Optional.of(parent));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(parent, source, sibling));
    when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> {
      Document saved = invocation.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 20L);
      return saved;
    });
    when(memberService.findNamesByIds(Set.of(1L))).thenReturn(Map.of(1L, "작성자"));

    DocumentSummary result = service().duplicate(5L, 1L);

    ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
    verify(documentRepository).save(captor.capture());
    Document copy = captor.getValue();
    assertThat(result.id()).isEqualTo(20L);
    assertThat(copy.getTitle()).isEqualTo("회의록 (사본)");
    assertThat(copy.getIcon()).isEqualTo("📘");
    assertThat(copy.getContentState()).containsExactly(1, 2, 3);
    assertThat(copy.getContentState()).isNotSameAs(source.getContentState());
    assertThat(copy.getPlainText()).isEqualTo("본문 내용");
    assertThat(copy.getParentId()).isEqualTo(3L);
    assertThat(copy.getSortOrder()).isEqualTo(5);
    assertThat(copy.getCreatedBy()).isEqualTo(1L);
    assertThat(copy.getKind()).isEqualTo(DocumentKind.PAGE);
  }

  // 본문에 복사해 붙여넣은 페이지는 붙여넣은 곳(다른 프로젝트 본문 포함) 아래에 원래 제목으로 사본을 만듦
  @Test
  void duplicate_withTargetParentInOtherSpace_placesCopyThere() {
    Space source = space(10L);
    Space target = space(20L);
    target.assignHomeDocument(50L);
    Document original = child(5L, 10L, null, "회의록");
    when(documentRepository.findById(5L)).thenReturn(Optional.of(original));
    when(documentRepository.findById(50L)).thenReturn(Optional.of(document(50L, 20L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(source));
    when(spaceRepository.findById(20L)).thenReturn(Optional.of(target));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(20L)).thenReturn(List.of());
    when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> {
      Document saved = invocation.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 21L);
      return saved;
    });
    when(memberService.findNamesByIds(Set.of(1L))).thenReturn(Map.of(1L, "작성자"));

    service().duplicate(5L, 1L, 50L);

    ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
    verify(documentRepository).save(captor.capture());
    assertThat(captor.getValue().getSpaceId()).isEqualTo(20L);
    // 프로젝트 본문 아래는 최상위
    assertThat(captor.getValue().getParentId()).isNull();
    // 붙여넣은 사본은 원래 제목 그대로 ("(사본)"은 블록 메뉴 복제에만)
    assertThat(captor.getValue().getTitle()).isEqualTo("회의록");
    assertThat(original.getSpaceId()).isEqualTo(10L);
  }

  // 파일·WBS 항목은 본문이 없어 복제하지 않음
  @Test
  void duplicate_file_throwsInvalidInput() {
    Document file = child(5L, 10L, null, Document.createFile(10L, "a.pdf", 1L));
    when(documentRepository.findById(5L)).thenReturn(Optional.of(file));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    assertThatThrownBy(() -> service().duplicate(5L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    verify(documentRepository, never()).save(any());
  }

  @Test
  void claimPageBlockBackfill_deletedDocument_throwsNotFound() {
    Document doc = document(1L, 10L);
    doc.softDelete();
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));

    assertThatThrownBy(() -> service().claimPageBlockBackfill(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    verify(documentRepository, never()).claimPageBlockBackfill(any());
  }

  @Test
  void getLiveDocument_deletedDocument_throwsNotFound() {
    Document doc = document(1L, 10L);
    doc.softDelete();
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));

    assertThatThrownBy(() -> service().getLiveDocument(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void getLiveDocument_spaceDeleted_throwsNotFound() {
    Space space = space(10L);
    space.softDelete();
    when(documentRepository.findById(1L)).thenReturn(Optional.of(document(1L, 10L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));

    assertThatThrownBy(() -> service().getLiveDocument(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void restore_clearsDeletedAt() {
    Document doc = document(1L, 10L);
    doc.softDelete();
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    service().restore(1L);

    assertThat(doc.getDeletedAt()).isNull();
  }

  @Test
  void create_blankTitle_usesDefault() {
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    DocumentSummary result = service().create(10L, "", null, 1L);

    assertThat(result.title()).isEqualTo("제목 없음");
    assertThat(result.updatedByName()).isEqualTo("홍길동");
  }

  @Test
  void rename_updatesTitleAndUpdatedBy() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동", 2L, "김철수"));

    service().rename(1L, " 새 제목 ", 2L);

    assertThat(doc.getTitle()).isEqualTo("새 제목");
    assertThat(doc.getUpdatedBy()).isEqualTo(2L);
  }

  private Document child(Long id, Long spaceId, Long parentId, String title) {
    Document doc = Document.create(spaceId, title, 1L);
    ReflectionTestUtils.setField(doc, "id", id);
    doc.placeUnder(parentId);
    return doc;
  }

  // 메인 화면 최근 수정된 게시글: 마지막 수정자 이름을 붙이고, 휴지통에 있는 상위 페이지 아래 글은 빼고 보여줌
  @Test
  void findRecent_addsUpdaterName_excludesUnderDeletedParent() {
    Document parent = child(1L, 10L, null, "상위");
    parent.softDelete();
    Document hidden = child(2L, 10L, 1L, "숨은 하위");
    Document visible = child(3L, 10L, null, "새 글");
    ReflectionTestUtils.setField(visible, "createdBy", 1L);
    ReflectionTestUtils.setField(visible, "updatedBy", 2L);
    when(documentRepository.findRecentlyUpdated(10)).thenReturn(List.of(visible, hidden));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(parent));
    when(spaceRepository.findAllById(any())).thenReturn(List.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(2L, "김철수"));

    List<dev.jkchappy.portal.document.dto.RecentDocument> result = service().findRecent(10);

    assertThat(result).extracting(dev.jkchappy.portal.document.dto.RecentDocument::title).containsExactly("새 글");
    assertThat(result.getFirst().updatedByName()).isEqualTo("김철수");
    assertThat(result.getFirst().spaceName()).isEqualTo("개발");
  }

  // 삭제된 페이지 아래에 함께 숨겨진 하위 페이지를 단계별로 펼쳐 보여줌
  @Test
  void findTrash_deletedPage_listsHiddenDescendantsWithDepth() {
    Document deleted = child(1L, 10L, null, "상위");
    deleted.changeIcon("🎯", 1L);
    deleted.softDelete();
    Document child = child(2L, 10L, 1L, "하위");
    Document grandChild = child(3L, 10L, 2L, "하위의 하위");
    Document sibling = child(4L, 10L, 1L, "형제");
    Document unrelated = child(5L, 10L, null, "다른 페이지");
    when(spaceRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc()).thenReturn(List.of());
    when(documentRepository.findTrashed()).thenReturn(List.of(deleted));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(child, grandChild, sibling, unrelated));

    var items = service().findTrash().items();

    assertThat(items).hasSize(1);
    assertThat(items.get(0).kind()).isEqualTo("document");
    assertThat(items.get(0).icon()).isEqualTo("🎯");
    assertThat(items.get(0).children())
      .extracting(c -> c.title() + ":" + c.depth())
      .containsExactly("하위:1", "하위의 하위:2", "형제:1");
  }

  // 삭제된 프로젝트는 본문 페이지를 빼고 최상위 페이지부터 펼치며, 페이지와 함께 최근 삭제순으로 정렬
  @Test
  void findTrash_deletedSpace_listsPagesAndSortsByDeletedAt() {
    Space space = space(10L);
    space.assignHomeDocument(100L);
    Document home = child(100L, 10L, null, "개발");
    home.changeIcon("🏫", 1L);
    Document top = child(1L, 10L, null, "최상위");
    Document sub = child(2L, 10L, 1L, "하위");
    Document page = child(50L, 20L, null, "다른 프로젝트 페이지");
    page.softDelete();
    ReflectionTestUtils.setField(page, "deletedAt", Instant.parse("2026-11-04T01:00:00Z"));
    ReflectionTestUtils.setField(space, "deletedAt", Instant.parse("2026-11-04T02:00:00Z"));
    when(spaceRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc()).thenReturn(List.of(space));
    when(documentRepository.findTrashed()).thenReturn(List.of(page));
    when(documentRepository.findById(100L)).thenReturn(Optional.of(home));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(home, top, sub));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(20L)).thenReturn(List.of());

    var items = service().findTrash().items();

    assertThat(items).extracting(i -> i.kind() + ":" + i.name()).containsExactly("space:개발", "document:다른 프로젝트 페이지");
    assertThat(items.get(0).icon()).isEqualTo("🏫");
    // 휴지통에서도 프로젝트·최상위 페이지를 구분해 기본 아이콘을 고름
    assertThat(items.get(0).spaceKind()).isEqualTo("PROJECT");
    assertThat(items.get(1).spaceKind()).isNull();
    assertThat(items.get(0).children()).extracting(c -> c.title() + ":" + c.depth()).containsExactly("최상위:1", "하위:2");
    assertThat(items.get(0).location()).isEqualTo("사이드바");
    assertThat(items.get(1).trashedParent()).isNull();
  }

  // 휴지통의 원래 위치: 프로젝트 이름 뒤에 살아 있는 상위 페이지만 이어 붙이고 본문 페이지는 뺌
  @Test
  void findTrash_deletedPage_locationListsLiveAncestors() {
    Space space = space(10L);
    space.assignHomeDocument(100L);
    Document home = child(100L, 10L, null, "개발");
    Document top = child(1L, 10L, 100L, "기획");
    Document removedParent = child(2L, 10L, 1L, "지난 자료");
    removedParent.softDelete();
    Document deleted = child(3L, 10L, 2L, "회의록");
    deleted.softDelete();
    when(spaceRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc()).thenReturn(List.of());
    when(documentRepository.findTrashed()).thenReturn(List.of(deleted));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(removedParent));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(top));
    when(documentRepository.findById(100L)).thenReturn(Optional.of(home));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(home, top));

    var items = service().findTrash().items();

    assertThat(items.get(0).location()).isEqualTo("개발 › 기획");
    // 원래 상위가 휴지통에 있어 원래 자리로 못 돌아감을 알림
    assertThat(items.get(0).trashedParent()).isEqualTo("지난 자료");
    assertThat(items.get(0).trashedParentId()).isEqualTo(2L);
  }

  // 더 위의 상위가 삭제됐으면 그 아래 살아 있는 상위도 숨겨져 있으므로, 복원 위치는 삭제된 상위 바로 위까지
  @Test
  void findTrash_ancestorAboveParentDeleted_locationStopsAboveIt() {
    Space space = space(10L);
    Document removedTop = child(1L, 10L, null, "기획");
    removedTop.softDelete();
    Document hiddenParent = child(2L, 10L, 1L, "회의록");
    Document deleted = child(3L, 10L, 2L, "4주차");
    deleted.softDelete();
    when(spaceRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc()).thenReturn(List.of());
    when(documentRepository.findTrashed()).thenReturn(List.of(deleted));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(hiddenParent));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(removedTop));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(hiddenParent));

    var item = service().findTrash().items().get(0);

    assertThat(item.location()).isEqualTo("개발");
    assertThat(item.trashedParent()).isEqualTo("기획");
  }

  // 같은 상위 안에서 index 위치로 끼워 넣고 형제들 순서를 0부터 다시 매김
  @Test
  void move_withIndex_reordersSiblings() {
    Document a = child(1L, 10L, null, "A");
    Document b = child(2L, 10L, null, "B");
    Document c = child(3L, 10L, null, "C");
    a.changeSortOrder(0);
    b.changeSortOrder(1);
    c.changeSortOrder(2);
    when(documentRepository.findById(3L)).thenReturn(Optional.of(c));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(a, b, c));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    // C를 A 앞(맨 위)으로
    service().move(3L, null, 0);

    assertThat(List.of(c, a, b)).extracting(Document::getSortOrder).containsExactly(0, 1, 2);
  }

  // 하위 페이지를 상위 단계의 두 페이지 사이로 꺼냄
  @Test
  void move_childOutBetweenParentLevelPages() {
    Document a = child(1L, 10L, null, "A");
    Document b = child(2L, 10L, null, "B");
    Document sub = child(3L, 10L, 1L, "A의 하위");
    a.changeSortOrder(0);
    b.changeSortOrder(1);
    when(documentRepository.findById(3L)).thenReturn(Optional.of(sub));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(a));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(a, b, sub));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    service().move(3L, null, 1);

    assertThat(sub.getParentId()).isNull();
    assertThat(List.of(a, sub, b)).extracting(Document::getSortOrder).containsExactly(0, 1, 2);
  }

  // index가 범위를 넘으면 맨 아래
  @Test
  void move_indexOutOfRange_placesLast() {
    Document a = child(1L, 10L, null, "A");
    Document b = child(2L, 10L, null, "B");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(a));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(a, b));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    service().move(1L, null, 99);

    assertThat(b.getSortOrder()).isEqualTo(0);
    assertThat(a.getSortOrder()).isEqualTo(1);
  }

  // 새 페이지는 같은 상위 안의 맨 아래 순서
  @Test
  void create_appendsAfterLastSibling() {
    Document existing = child(1L, 10L, null, "기존");
    existing.changeSortOrder(4);
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(existing));
    when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));
    org.mockito.ArgumentCaptor<Document> saved = org.mockito.ArgumentCaptor.forClass(Document.class);

    service().create(10L, "새 페이지", null, 1L);

    verify(documentRepository).save(saved.capture());
    assertThat(saved.getValue().getSortOrder()).isEqualTo(5);
  }

  @Test
  void move_underOtherPage_setsParent() {
    Document doc = child(1L, 10L, null, "옮길 페이지");
    Document target = child(2L, 10L, null, "새 상위");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(target));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var detail = service().move(1L, 2L, null);

    assertThat(doc.getParentId()).isEqualTo(2L);
    assertThat(detail.parentId()).isEqualTo(2L);
  }

  @Test
  void move_toTopLevel_clearsParent() {
    Document doc = child(1L, 10L, 2L, "하위");
    Document parent = child(2L, 10L, null, "상위");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(parent));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    service().move(1L, null, null);

    assertThat(doc.getParentId()).isNull();
  }

  // 자기 하위 페이지 안으로 옮기면 순환이 생기므로 거부
  @Test
  void move_intoOwnDescendant_rejected() {
    Document doc = child(1L, 10L, null, "상위");
    Document sub = child(2L, 10L, 1L, "하위");
    Document grandChild = child(3L, 10L, 2L, "하위의 하위");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(sub));
    when(documentRepository.findById(3L)).thenReturn(Optional.of(grandChild));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    assertThatThrownBy(() -> service().move(1L, 3L, null))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    assertThat(doc.getParentId()).isNull();
  }

  @Test
  void move_underSelf_rejected() {
    Document doc = child(1L, 10L, null, "페이지");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    assertThatThrownBy(() -> service().move(1L, 1L, null)).isInstanceOf(BusinessException.class);
  }

  // 본문에서 잘라내 다른 프로젝트 본문에 붙여넣으면 그 프로젝트 최상위로 옮기고 하위 페이지도 함께 옮김
  @Test
  void move_toOtherSpaceHome_movesSubtreeToThatSpace() {
    Document doc = child(1L, 10L, null, "옮길 페이지");
    Document sub = child(3L, 10L, 1L, "하위");
    Document unrelated = child(6L, 10L, null, "그대로 둘 페이지");
    Space target = space(20L);
    target.assignHomeDocument(50L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(50L)).thenReturn(Optional.of(document(50L, 20L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(spaceRepository.findById(20L)).thenReturn(Optional.of(target));
    when(documentRepository.findBySpaceId(10L)).thenReturn(List.of(doc, sub, unrelated));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    service().move(1L, 50L, null);

    assertThat(doc.getSpaceId()).isEqualTo(20L);
    assertThat(doc.getParentId()).isNull();
    assertThat(sub.getSpaceId()).isEqualTo(20L);
    assertThat(sub.getParentId()).isEqualTo(1L);
    assertThat(unrelated.getSpaceId()).isEqualTo(10L);
  }

  // 다른 프로젝트의 페이지 아래로 옮기면 그 페이지의 하위가 됨
  @Test
  void move_underPageInOtherSpace_setsParentAndSpace() {
    Document doc = child(1L, 10L, null, "옮길 페이지");
    Document other = child(2L, 20L, null, "다른 프로젝트 페이지");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(other));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(spaceRepository.findById(20L)).thenReturn(Optional.of(space(20L)));
    when(documentRepository.findBySpaceId(10L)).thenReturn(List.of(doc));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    service().move(1L, 2L, null);

    assertThat(doc.getSpaceId()).isEqualTo(20L);
    assertThat(doc.getParentId()).isEqualTo(2L);
  }

  @Test
  void move_homeDocument_rejected() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    Document home = child(1L, 10L, null, "개발");
    when(documentRepository.findById(1L)).thenReturn(Optional.of(home));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));

    assertThatThrownBy(() -> service().move(1L, null, null)).isInstanceOf(BusinessException.class);
  }

  // 파일 항목은 확장자별 아이콘을 달고 같은 상위 안의 맨 아래에 생성
  @Test
  void createFile_setsKindIconAndAppends() {
    Document parent = child(5L, 10L, null, "상위");
    Document sibling = child(6L, 10L, 5L, "기존 하위");
    sibling.changeSortOrder(2);
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findById(5L)).thenReturn(Optional.of(parent));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(parent, sibling));
    when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));

    Document file = service().createFile(10L, "품의서 양식.xlsx", 5L, 1L);

    assertThat(file.isFile()).isTrue();
    assertThat(file.getIcon()).isEqualTo("📊");
    assertThat(file.getParentId()).isEqualTo(5L);
    assertThat(file.getSortOrder()).isEqualTo(3);
  }

  // 파일 안에는 페이지나 다른 파일을 넣을 수 없음
  @Test
  void create_underFile_rejected() {
    Document file = Document.createFile(10L, "양식.xlsx", 1L);
    ReflectionTestUtils.setField(file, "id", 5L);
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findById(5L)).thenReturn(Optional.of(file));

    assertThatThrownBy(() -> service().create(10L, "하위", 5L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void move_intoFile_rejected() {
    Document doc = child(1L, 10L, null, "페이지");
    Document file = Document.createFile(10L, "양식.xlsx", 1L);
    ReflectionTestUtils.setField(file, "id", 2L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(file));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    assertThatThrownBy(() -> service().move(1L, 2L, null)).isInstanceOf(BusinessException.class);
    assertThat(doc.getParentId()).isNull();
  }

  // 목록에서 파일 항목은 종류와 다운로드 주소를 함께 내려줌
  @Test
  void findBySpace_fileNodeHasKindAndDownloadUrl() {
    Document file = Document.createFile(10L, "회의록 양식.docx", 1L);
    ReflectionTestUtils.setField(file, "id", 3L);
    file.attachFile(30L);
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(file));
    when(spaceRepository.findAllById(any())).thenReturn(List.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var result = service().findBySpace(10L);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).kind()).isEqualTo("FILE");
    assertThat(result.get(0).fileUrl()).isEqualTo("/api/attachments/30/download");
    assertThat(result.get(0).icon()).isEqualTo("📝");
  }

  @Test
  void changeIcon_setsTrimmedIconAndUpdatedBy() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동", 2L, "김철수"));

    var detail = service().changeIcon(1L, " 🚀 ", 2L);

    assertThat(doc.getIcon()).isEqualTo("🚀");
    assertThat(doc.getUpdatedBy()).isEqualTo(2L);
    assertThat(detail.icon()).isEqualTo("🚀");
  }

  @Test
  void changeIcon_uploadedImageOfSameDocument_isSaved() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of());
    when(attachmentRepository.findById(7L)).thenReturn(Optional.of(
      dev.jkchappy.portal.attachment.Attachment.create(1L, "logo.png", "stored", "image/png", 1024, true, 1L)));

    service().changeIcon(1L, "att:7", 1L);

    assertThat(doc.getIcon()).isEqualTo("att:7");
  }

  @Test
  void changeIcon_uploadedImageOfOtherDocumentOrNonImage_isRejected() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(attachmentRepository.findById(7L)).thenReturn(Optional.of(
      dev.jkchappy.portal.attachment.Attachment.create(2L, "logo.png", "stored", "image/png", 1024, true, 1L)));
    when(attachmentRepository.findById(8L)).thenReturn(Optional.of(
      dev.jkchappy.portal.attachment.Attachment.create(1L, "icon.svg", "stored", "image/svg+xml", 1024, true, 1L)));
    when(attachmentRepository.findById(9L)).thenReturn(Optional.of(
      dev.jkchappy.portal.attachment.Attachment.create(1L, "big.png", "stored", "image/png", 6L * 1024 * 1024, true, 1L)));

    for (String icon : List.of("att:7", "att:8", "att:9", "att:404")) {
      assertThatThrownBy(() -> service().changeIcon(1L, icon, 1L))
        .as(icon)
        .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }
    assertThat(doc.getIcon()).isNull();
  }

  @Test
  void changeIcon_httpsImageLink_isSavedAndOtherLinksAreRejected() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of());

    service().changeIcon(1L, "https://example.com/logo.png", 1L);
    assertThat(doc.getIcon()).isEqualTo("https://example.com/logo.png");

    for (String icon : List.of("http://example.com/logo.png", "javascript:alert(1)", "https://exa mple.com/a.png")) {
      assertThatThrownBy(() -> service().changeIcon(1L, icon, 1L))
        .as(icon)
        .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }
  }

  @Test
  void changeIcon_blank_removesIcon() {
    Document doc = document(1L, 10L);
    doc.changeIcon("🚀", 1L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    service().changeIcon(1L, "  ", 1L);

    assertThat(doc.getIcon()).isNull();
  }

  @Test
  void changeIcon_deletedDocument_throwsNotFound() {
    Document doc = document(1L, 10L);
    doc.softDelete();
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));

    assertThatThrownBy(() -> service().changeIcon(1L, "🚀", 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  // 파일 항목 상세는 미리보기 화면이 쓰도록 종류와 다운로드 주소를 함께 내려줌
  @Test
  void getDetail_fileNode_hasKindAndDownloadUrl() {
    Document file = Document.createFile(10L, "품의서.xlsx", 1L);
    ReflectionTestUtils.setField(file, "id", 3L);
    file.attachFile(30L);
    when(documentRepository.findById(3L)).thenReturn(Optional.of(file));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var detail = service().getDetail(3L);

    assertThat(detail.kind()).isEqualTo("FILE");
    assertThat(detail.fileUrl()).isEqualTo("/api/attachments/30/download");
  }

  @Test
  void getDetail_creatorIsUpdater_doesNotThrow() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var detail = service().getDetail(1L);

    assertThat(detail.createdByName()).isEqualTo("홍길동");
    assertThat(detail.updatedByName()).isEqualTo("홍길동");
  }

  @Test
  void rename_byCreator_succeeds() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var detail = service().rename(1L, "새 제목", 1L);

    assertThat(detail.title()).isEqualTo("새 제목");
  }

  @Test
  void search_shortQuery_returnsEmpty() {
    List<DocumentSummary> result = service().search("a");

    assertThat(result).isEmpty();
    verify(documentRepository, never()).search(any());
  }

  @Test
  void search_escapesLikeWildcards() {
    when(documentRepository.search("%100\\%%")).thenReturn(List.of());

    assertThat(service().search("100%")).isEmpty();
    verify(documentRepository).search("%100\\%%");
  }

  private Document liveDocument() {
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    return doc;
  }

  private DocumentService serviceAt(Instant now) {
    return new DocumentService(documentRepository, spaceRepository, memberService,
      snapshotRepository, attachmentRepository, Clock.fixed(now, ZoneOffset.UTC));
  }

  @Test
  void saveContent_fileDocument_rejected() {
    Document doc = liveDocument();
    ReflectionTestUtils.setField(doc, "kind", DocumentKind.FILE);

    assertThatThrownBy(() -> service().saveContent(1L, new byte[] {1}, "본문", 2L))
      .isInstanceOf(BusinessException.class);
    assertThat(doc.getContentState()).isNull();
  }

  @Test
  void saveContent_wbsDocument_savesNotesBelowTable() {
    Document doc = liveDocument();
    ReflectionTestUtils.setField(doc, "kind", DocumentKind.WBS);
    when(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.empty());

    service().saveContent(1L, new byte[] {1}, "회의 메모", 2L);

    assertThat(doc.getPlainText()).isEqualTo("회의 메모");
  }

  @Test
  void create_fileKind_rejected() {
    assertThatThrownBy(() -> service().create(10L, "파일", null, DocumentKind.FILE, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void saveContent_firstSave_createsSnapshot() {
    Document doc = liveDocument();
    when(memberService.findNamesByIds(Set.of(2L))).thenReturn(Map.of(2L, "김팀원"));
    when(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.empty());
    Instant now = Instant.parse("2026-11-04T01:00:00Z");

    serviceAt(now).saveContent(1L, new byte[] {1}, "본문", 2L);

    assertThat(doc.getContentState()).containsExactly(1);
    assertThat(doc.getPlainText()).isEqualTo("본문");
    assertThat(doc.getUpdatedBy()).isEqualTo(2L);
    ArgumentCaptor<DocumentSnapshot> captor = ArgumentCaptor.forClass(DocumentSnapshot.class);
    verify(snapshotRepository).save(captor.capture());
    assertThat(captor.getValue().getCreatedAt()).isEqualTo(now);
    assertThat(captor.getValue().getContentState()).containsExactly(1);
    // 수정 이력에 보여줄 수정자와 자동 사본 종류
    assertThat(captor.getValue().getCreatedBy()).isEqualTo(2L);
    assertThat(captor.getValue().getReason()).isEqualTo(SnapshotReason.AUTO);
  }

  @Test
  void saveContent_within10Minutes_doesNotCreateSnapshot() {
    liveDocument();
    Instant last = Instant.parse("2026-11-04T01:00:00Z");
    when(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(1L))
      .thenReturn(Optional.of(DocumentSnapshot.create(1L, new byte[] {0}, last)));

    serviceAt(last.plusSeconds(599)).saveContent(1L, new byte[] {1}, "본문", null);

    verify(snapshotRepository, never()).save(any());
  }

  @Test
  void saveContent_after10Minutes_createsSnapshot() {
    liveDocument();
    Instant last = Instant.parse("2026-11-04T01:00:00Z");
    when(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(1L))
      .thenReturn(Optional.of(DocumentSnapshot.create(1L, new byte[] {0}, last)));

    serviceAt(last.plusSeconds(600)).saveContent(1L, new byte[] {1}, "본문", null);

    verify(snapshotRepository).save(any(DocumentSnapshot.class));
  }

  @Test
  void saveContent_unknownUpdatedBy_keepsPreviousUpdatedBy() {
    Document doc = liveDocument();
    when(memberService.findNamesByIds(Set.of(99L))).thenReturn(Map.of());
    when(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.empty());

    serviceAt(Instant.parse("2026-11-04T01:00:00Z")).saveContent(1L, new byte[] {1}, "본문", 99L);

    assertThat(doc.getUpdatedBy()).isEqualTo(1L);
  }

  @Test
  void saveContent_nullUpdatedBy_keepsPreviousUpdatedBy() {
    Document doc = liveDocument();
    when(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(1L)).thenReturn(Optional.empty());

    serviceAt(Instant.parse("2026-11-04T01:00:00Z")).saveContent(1L, new byte[] {1}, "본문", null);

    assertThat(doc.getUpdatedBy()).isEqualTo(1L);
  }

  // 커버는 프로젝트 본문에만, 같은 문서에 올린 이미지·https 주소만 허용
  @Test
  void changeCover_home_storesUploadedImageAndHttpsAndBlankRemoves() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    Document doc = document(1L, 10L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of());
    when(attachmentRepository.findById(7L)).thenReturn(Optional.of(
      dev.jkchappy.portal.attachment.Attachment.create(1L, "cover.png", "stored", "image/png", 1024, true, 1L)));

    service().changeCover(1L, " att:7 ", 2L);
    assertThat(doc.getCover()).isEqualTo("att:7");
    assertThat(doc.getUpdatedBy()).isEqualTo(2L);

    service().changeCover(1L, "https://x.com/cover.jpg", 2L);
    assertThat(doc.getCover()).isEqualTo("https://x.com/cover.jpg");

    service().changeCover(1L, " ", 2L);
    assertThat(doc.getCover()).isNull();
  }

  @Test
  void changeCover_invalidValues_throwInvalidInput() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(document(1L, 10L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(attachmentRepository.findById(7L)).thenReturn(Optional.of(
      dev.jkchappy.portal.attachment.Attachment.create(2L, "other.png", "stored", "image/png", 1024, true, 1L)));

    for (String cover : List.of("att:7", "🎯", "http://x.com/a.png")) {
      assertThatThrownBy(() -> service().changeCover(1L, cover, 1L))
        .as(cover)
        .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }
  }

  // 커버는 메인 화면 갤러리용이라 최상위 페이지 본문에는 넣을 수 없음
  @Test
  void changeCover_topLevelPage_throwsInvalidInput() {
    Space page = Space.create("메모", null, dev.jkchappy.portal.space.SpaceKind.PAGE, 1L);
    ReflectionTestUtils.setField(page, "id", 10L);
    page.assignHomeDocument(1L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(document(1L, 10L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(page));

    assertThatThrownBy(() -> service().changeCover(1L, "https://x.com/a.png", 1L))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void changeCover_notHome_throwsInvalidInput() {
    liveDocument();

    assertThatThrownBy(() -> service().changeCover(1L, "https://x.com/a.png", 1L))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  // 프로젝트 본문 페이지는 단독으로 삭제할 수 없음 (프로젝트 삭제로만)
  @Test
  void delete_homeDocument_rejected() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(document(1L, 10L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));

    assertThatThrownBy(() -> service().delete(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  // 하위 페이지 목록에는 본문 페이지를 넣지 않음
  @Test
  void findBySpace_excludesHomeDocument() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(document(1L, 10L), document(2L, 10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    assertThat(service().findBySpace(10L)).extracting(DocumentSummary::id).containsExactly(2L);
  }

  // 본문 페이지 제목을 바꾸면 프로젝트 이름도 같이 바뀜
  @Test
  void rename_homeDocument_renamesSpace() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    when(documentRepository.findById(1L)).thenReturn(Optional.of(document(1L, 10L)));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var detail = service().rename(1L, "인생서가", 1L);

    assertThat(space.getName()).isEqualTo("인생서가");
    assertThat(detail.home()).isTrue();
  }

  private Document child(Long id, Long spaceId, Long parentId) {
    Document doc = document(id, spaceId);
    ReflectionTestUtils.setField(doc, "parentId", parentId);
    return doc;
  }

  // 페이지 안에 하위 페이지 생성
  @Test
  void create_withParent_setsParent() {
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(document(2L, 10L)));
    when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    DocumentSummary result = service().create(10L, "API 명세", 2L, 1L);

    assertThat(result.parentId()).isEqualTo(2L);
  }

  // 다른 프로젝트의 페이지 아래에는 만들 수 없음
  @Test
  void create_parentInOtherSpace_rejected() {
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(spaceRepository.findById(20L)).thenReturn(Optional.of(space(20L)));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(document(2L, 20L)));

    assertThatThrownBy(() -> service().create(10L, "x", 2L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  // 프로젝트 본문 아래 = 최상위 페이지
  @Test
  void create_underHomeDocument_isTopLevel() {
    Space space = space(10L);
    space.assignHomeDocument(1L);
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));
    when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    assertThat(service().create(10L, "x", 1L, 1L).parentId()).isNull();
  }

  // 상위 페이지가 삭제되면 하위 페이지도 없는 페이지로 취급
  @Test
  void getLiveDocument_ancestorDeleted_throwsNotFound() {
    Document parent = document(2L, 10L);
    parent.softDelete();
    when(documentRepository.findById(3L)).thenReturn(Optional.of(child(3L, 10L, 2L)));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(parent));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    assertThatThrownBy(() -> service().getLiveDocument(3L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  // 삭제된 페이지의 하위 페이지는 목록에서 숨김 (삭제된 페이지는 조회 결과에 없음)
  @Test
  void findBySpace_hidesDescendantsOfDeletedPage() {
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(10L))
      .thenReturn(List.of(document(2L, 10L), child(4L, 10L, 3L), child(5L, 10L, 4L), child(6L, 10L, 2L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    assertThat(service().findBySpace(10L)).extracting(DocumentSummary::id).containsExactly(2L, 6L);
  }

  // 상세에 최상위부터 바로 위까지의 경로 포함
  @Test
  void getDetail_returnsAncestorPath() {
    Document top = document(2L, 10L);
    ReflectionTestUtils.setField(top, "title", "백엔드");
    Document mid = child(3L, 10L, 2L);
    ReflectionTestUtils.setField(mid, "title", "API");
    when(documentRepository.findById(4L)).thenReturn(Optional.of(child(4L, 10L, 3L)));
    when(documentRepository.findById(3L)).thenReturn(Optional.of(mid));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(top));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    var detail = service().getDetail(4L);

    assertThat(detail.parentId()).isEqualTo(3L);
    assertThat(detail.path()).extracting(dev.jkchappy.portal.document.dto.PageRef::title)
      .containsExactly("백엔드", "API");
  }

  // 상위 페이지가 삭제된 상태에서 복원하면 최상위로 옮겨 보이게 함
  @Test
  void restore_parentDeleted_movesToTopLevel() {
    Document parent = document(2L, 10L);
    parent.softDelete();
    Document doc = child(3L, 10L, 2L);
    doc.softDelete();
    when(documentRepository.findById(3L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(parent));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    service().restore(3L);

    assertThat(doc.isDeleted()).isFalse();
    assertThat(doc.getParentId()).isNull();
  }

  // A(살아 있음) / B(삭제) / C(함께 숨겨짐) 에서 C만 복원하면 B를 건너뛰고 A 아래로 옮김
  @Test
  void restore_hiddenChild_movesUnderNearestLiveAncestor() {
    Document a = child(1L, 10L, null);
    Document b = child(2L, 10L, 1L);
    b.softDelete();
    Document c = child(3L, 10L, 2L);
    when(documentRepository.findById(3L)).thenReturn(Optional.of(c));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(b));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(a));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    service().restore(3L);

    assertThat(c.isDeleted()).isFalse();
    assertThat(c.getParentId()).isEqualTo(1L);
    // 삭제된 상위는 그대로 휴지통에 남음
    assertThat(b.isDeleted()).isTrue();
  }

  // 위쪽 조상이 삭제됐으면 그 아래 살아 있는 조상도 숨겨진 상태라 더 위로 올라감
  @Test
  void restore_hiddenChild_skipsLiveAncestorUnderDeletedOne() {
    Document top = child(1L, 10L, null);
    top.softDelete();
    Document middle = child(2L, 10L, 1L);
    Document doc = child(3L, 10L, 2L);
    when(documentRepository.findById(3L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(2L)).thenReturn(Optional.of(middle));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(top));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    service().restore(3L);

    assertThat(doc.getParentId()).isNull();
  }

  // 상위가 모두 살아 있는 페이지는 위치를 바꾸지 않음
  @Test
  void restore_visiblePage_keepsParent() {
    Document parent = child(1L, 10L, null);
    Document doc = child(2L, 10L, 1L);
    doc.softDelete();
    when(documentRepository.findById(2L)).thenReturn(Optional.of(doc));
    when(documentRepository.findById(1L)).thenReturn(Optional.of(parent));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));

    service().restore(2L);

    assertThat(doc.isDeleted()).isFalse();
    assertThat(doc.getParentId()).isEqualTo(1L);
  }

  @Test
  void restore_spaceDeleted_rejected() {
    Space space = space(10L);
    space.softDelete();
    Document doc = child(3L, 10L, null);
    when(documentRepository.findById(3L)).thenReturn(Optional.of(doc));
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space));

    assertThatThrownBy(() -> service().restore(3L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }
}
