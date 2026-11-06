package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.HistoryEntry;
import dev.jkchappy.portal.document.dto.HistoryVersion;
import dev.jkchappy.portal.document.dto.SnapshotMeta;
import dev.jkchappy.portal.member.MemberService;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 페이지 본문 사본을 수정 이력으로 조회하고, 되돌리기 직전 본문을 사본으로 남김
@Service
@RequiredArgsConstructor
public class DocumentHistoryService {

  static final int MAX_ENTRIES = 100;

  private final DocumentService documentService;
  private final DocumentSnapshotRepository snapshotRepository;
  private final MemberService memberService;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<HistoryEntry> findHistory(Long documentId) {
    getLivePage(documentId);
    List<SnapshotMeta> metas = snapshotRepository.findMetaByDocumentId(documentId,
      PageRequest.of(0, MAX_ENTRIES));
    Set<Long> userIds = new HashSet<>();
    metas.stream().map(SnapshotMeta::createdBy).filter(Objects::nonNull).forEach(userIds::add);
    Map<Long, String> names = userIds.isEmpty() ? Map.of() : memberService.findNamesByIds(userIds);
    return metas.stream()
      .map(m -> new HistoryEntry(m.id(), m.createdAt().atOffset(ZoneOffset.UTC),
        m.createdBy() == null ? null : names.get(m.createdBy()), m.reason().name()))
      .toList();
  }

  // 다른 페이지의 사본 번호로 요청하면 NOT_FOUND
  @Transactional(readOnly = true)
  public HistoryVersion getVersion(Long documentId, Long snapshotId) {
    getLivePage(documentId);
    DocumentSnapshot snapshot = snapshotRepository.findById(snapshotId)
      .filter(s -> s.getDocumentId().equals(documentId))
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    String name = snapshot.getCreatedBy() == null ? null
      : memberService.findNamesByIds(Set.of(snapshot.getCreatedBy())).get(snapshot.getCreatedBy());
    return new HistoryVersion(snapshot.getId(), snapshot.getCreatedAt().atOffset(ZoneOffset.UTC), name,
      snapshot.getReason().name(), snapshot.getContentState());
  }

  // 되돌리기 직전 본문을 사본으로 남겨 되돌리기도 다시 되돌릴 수 있게 함
  @Transactional
  public HistoryEntry saveCheckpoint(Long documentId, byte[] contentState, Long userId) {
    getLivePage(documentId);
    DocumentSnapshot saved = snapshotRepository.save(DocumentSnapshot.create(documentId, contentState,
      clock.instant(), userId, SnapshotReason.BEFORE_RESTORE));
    String name = memberService.findNamesByIds(Set.of(userId)).get(userId);
    return new HistoryEntry(saved.getId(), saved.getCreatedAt().atOffset(ZoneOffset.UTC), name,
      saved.getReason().name());
  }

  // 파일·WBS 항목은 본문이 없어 이력 대상이 아님
  private Document getLivePage(Long documentId) {
    Document doc = documentService.getLiveDocument(documentId);
    if (!doc.isPage()) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }
    return doc;
  }
}
