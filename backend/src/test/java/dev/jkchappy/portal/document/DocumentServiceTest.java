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

  private DocumentService service() {
    return new DocumentService(documentRepository, spaceRepository, memberService,
      snapshotRepository, Clock.systemUTC());
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

    service().restore(1L);

    assertThat(doc.getDeletedAt()).isNull();
  }

  @Test
  void create_blankTitle_usesDefault() {
    when(spaceRepository.findById(10L)).thenReturn(Optional.of(space(10L)));
    when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "홍길동"));

    DocumentSummary result = service().create(10L, "", 1L);

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
      snapshotRepository, Clock.fixed(now, ZoneOffset.UTC));
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
}
