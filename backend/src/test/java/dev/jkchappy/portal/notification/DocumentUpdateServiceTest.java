package dev.jkchappy.portal.notification;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.document.DocumentService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DocumentUpdateServiceTest {

  private static final Instant NOW = Instant.parse("2026-11-05T01:00:00Z");

  @Mock
  private DocumentRepository documentRepository;

  @Mock
  private DocumentReadRepository documentReadRepository;

  @Mock
  private DocumentService documentService;

  private DocumentUpdateService service() {
    return new DocumentUpdateService(documentRepository, documentReadRepository, documentService,
      Clock.fixed(NOW, ZoneOffset.UTC));
  }

  private Document document(Long id) {
    Document doc = Document.create(10L, "문서", 2L);
    ReflectionTestUtils.setField(doc, "id", id);
    return doc;
  }

  @Test
  void findUnread_looksBackFourteenDays() {
    List<Document> docs = List.of(document(1L));
    when(documentRepository.findUnreadUpdates(1L, NOW.minus(DocumentUpdateService.LOOKBACK),
      DocumentUpdateService.MAX_ITEMS)).thenReturn(docs);

    service().findUnread(1L);

    verify(documentService).summarizeVisible(docs);
  }

  @Test
  void markRead_savesNow() {
    service().markRead(1L, 5L);

    verify(documentService).getLiveDocument(5L);
    verify(documentReadRepository).upsert(1L, 5L, NOW);
  }

  @Test
  void markRead_deletedDocument_throwsNotFoundWithoutSaving() {
    when(documentService.getLiveDocument(5L)).thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    assertThatThrownBy(() -> service().markRead(1L, 5L)).isInstanceOf(BusinessException.class);
    verify(documentReadRepository, never()).upsert(anyLong(), anyLong(), any());
  }

  @Test
  void markAllRead_marksEveryUnreadDocument() {
    when(documentRepository.findUnreadUpdates(eq(1L), any(), eq(DocumentUpdateService.MAX_ITEMS)))
      .thenReturn(List.of(document(3L), document(4L)));

    service().markAllRead(1L);

    verify(documentReadRepository).upsert(1L, 3L, NOW);
    verify(documentReadRepository).upsert(1L, 4L, NOW);
  }
}
