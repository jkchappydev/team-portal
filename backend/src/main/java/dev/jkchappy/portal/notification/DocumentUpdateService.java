package dev.jkchappy.portal.notification;

import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 다른 팀원이 수정한 페이지 중 아직 확인하지 않은 것을 알림으로 제공
@Service
@RequiredArgsConstructor
public class DocumentUpdateService {

  // 너무 오래된 수정은 알림에서 제외
  static final Duration LOOKBACK = Duration.ofDays(14);
  static final int MAX_ITEMS = 30;

  private final DocumentRepository documentRepository;
  private final DocumentReadRepository documentReadRepository;
  private final DocumentService documentService;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<DocumentSummary> findUnread(Long memberId) {
    Instant since = clock.instant().minus(LOOKBACK);
    return documentService.summarizeVisible(
      documentRepository.findUnreadUpdates(memberId, since, MAX_ITEMS));
  }

  // 페이지를 열거나 닫을 때 확인 시각 기록 (삭제된 페이지는 NOT_FOUND)
  @Transactional
  public void markRead(Long memberId, Long documentId) {
    documentService.getLiveDocument(documentId);
    documentReadRepository.upsert(memberId, documentId, clock.instant());
  }

  // 지금 보이는 알림을 모두 확인 처리
  @Transactional
  public void markAllRead(Long memberId) {
    Instant now = clock.instant();
    documentRepository.findUnreadUpdates(memberId, now.minus(LOOKBACK), MAX_ITEMS)
      .forEach(doc -> documentReadRepository.upsert(memberId, doc.getId(), now));
  }
}
