package dev.jkchappy.portal.notification;

import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.notification.dto.DocumentUpdateResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 다른 팀원이 수정했거나 나를 @언급한 페이지 중 아직 확인하지 않은 것을 알림으로 제공 (프로젝트별 알림 설정 적용)
@Service
@RequiredArgsConstructor
public class DocumentUpdateService {

  // 너무 오래된 수정은 알림에서 제외
  static final Duration LOOKBACK = Duration.ofDays(14);
  static final int MAX_ITEMS = 30;

  private final DocumentRepository documentRepository;
  private final DocumentReadRepository documentReadRepository;
  private final DocumentMentionRepository documentMentionRepository;
  private final DocumentService documentService;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<DocumentUpdateResponse> findUnread(Long memberId) {
    Instant since = clock.instant().minus(LOOKBACK);
    List<Document> docs = documentRepository.findUnreadUpdates(memberId, since, MAX_ITEMS);
    // 아직 확인하지 않은 @언급이 있는 페이지는 화면에 언급 표시
    Set<Long> mentioned = docs.isEmpty() ? Set.of() : new HashSet<>(documentMentionRepository
      .findUnreadMentionedDocumentIds(memberId, docs.stream().map(Document::getId).toList()));
    return documentService.summarizeVisible(docs).stream()
      .map(summary -> DocumentUpdateResponse.of(summary, mentioned.contains(summary.id())))
      .toList();
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
