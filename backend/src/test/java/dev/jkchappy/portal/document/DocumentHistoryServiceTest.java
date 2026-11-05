package dev.jkchappy.portal.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.HistoryEntry;
import dev.jkchappy.portal.document.dto.HistoryVersion;
import dev.jkchappy.portal.document.dto.SnapshotMeta;
import dev.jkchappy.portal.member.MemberService;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DocumentHistoryServiceTest {

  private static final Instant NOW = Instant.parse("2026-11-05T01:00:00Z");

  @Mock
  private DocumentService documentService;

  @Mock
  private DocumentSnapshotRepository snapshotRepository;

  @Mock
  private MemberService memberService;

  private DocumentHistoryService service() {
    return new DocumentHistoryService(documentService, snapshotRepository, memberService,
      Clock.fixed(NOW, ZoneOffset.UTC));
  }

  private Document page(Long id) {
    Document doc = Document.create(10L, "문서", 1L);
    ReflectionTestUtils.setField(doc, "id", id);
    when(documentService.getLiveDocument(id)).thenReturn(doc);
    return doc;
  }

  private DocumentSnapshot snapshot(Long id, Long documentId, Long createdBy) {
    DocumentSnapshot s = DocumentSnapshot.create(documentId, new byte[] {7}, NOW, createdBy, SnapshotReason.AUTO);
    ReflectionTestUtils.setField(s, "id", id);
    return s;
  }

  @Test
  void findHistory_mapsAuthorNames_oldSnapshotsWithoutAuthor() {
    page(1L);
    when(snapshotRepository.findMetaByDocumentId(1L, PageRequest.of(0, DocumentHistoryService.MAX_ENTRIES)))
      .thenReturn(List.of(
        new SnapshotMeta(5L, NOW, 2L, SnapshotReason.BEFORE_RESTORE),
        new SnapshotMeta(4L, NOW.minusSeconds(600), null, SnapshotReason.AUTO)));
    when(memberService.findNamesByIds(Set.of(2L))).thenReturn(Map.of(2L, "김팀원"));

    List<HistoryEntry> result = service().findHistory(1L);

    assertThat(result).extracting(HistoryEntry::id).containsExactly(5L, 4L);
    assertThat(result.get(0).createdByName()).isEqualTo("김팀원");
    assertThat(result.get(0).reason()).isEqualTo("BEFORE_RESTORE");
    assertThat(result.get(1).createdByName()).isNull();
  }

  @Test
  void findHistory_fileItem_throwsNotFound() {
    Document file = page(1L);
    ReflectionTestUtils.setField(file, "kind", DocumentKind.FILE);

    assertThatThrownBy(() -> service().findHistory(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void getVersion_returnsContentState() {
    page(1L);
    when(snapshotRepository.findById(5L)).thenReturn(Optional.of(snapshot(5L, 1L, 2L)));
    when(memberService.findNamesByIds(Set.of(2L))).thenReturn(Map.of(2L, "김팀원"));

    HistoryVersion version = service().getVersion(1L, 5L);

    assertThat(version.contentState()).containsExactly(7);
    assertThat(version.createdByName()).isEqualTo("김팀원");
  }

  @Test
  void getVersion_snapshotOfOtherDocument_throwsNotFound() {
    page(1L);
    when(snapshotRepository.findById(5L)).thenReturn(Optional.of(snapshot(5L, 99L, null)));

    assertThatThrownBy(() -> service().getVersion(1L, 5L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void saveCheckpoint_savesBeforeRestoreSnapshotByUser() {
    page(1L);
    when(snapshotRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(memberService.findNamesByIds(Set.of(3L))).thenReturn(Map.of(3L, "이팀원"));

    HistoryEntry entry = service().saveCheckpoint(1L, new byte[] {9}, 3L);

    ArgumentCaptor<DocumentSnapshot> captor = ArgumentCaptor.forClass(DocumentSnapshot.class);
    verify(snapshotRepository).save(captor.capture());
    assertThat(captor.getValue().getReason()).isEqualTo(SnapshotReason.BEFORE_RESTORE);
    assertThat(captor.getValue().getCreatedBy()).isEqualTo(3L);
    assertThat(captor.getValue().getCreatedAt()).isEqualTo(NOW);
    assertThat(captor.getValue().getContentState()).containsExactly(9);
    assertThat(entry.createdByName()).isEqualTo("이팀원");
  }

  @Test
  void saveCheckpoint_deletedDocument_doesNotSave() {
    when(documentService.getLiveDocument(1L)).thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    assertThatThrownBy(() -> service().saveCheckpoint(1L, new byte[] {9}, 3L))
      .isInstanceOf(BusinessException.class);
    verify(snapshotRepository, never()).save(any());
    verify(memberService, never()).findNamesByIds(eq(Set.of(3L)));
  }
}
