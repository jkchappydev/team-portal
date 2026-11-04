package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.DocumentDetail;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import dev.jkchappy.portal.document.dto.TrashItem;
import dev.jkchappy.portal.document.dto.TrashResponse;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DocumentService {

  private static final int MIN_QUERY_LENGTH = 2;
  private static final Duration SNAPSHOT_INTERVAL = Duration.ofMinutes(10);

  private final DocumentRepository documentRepository;
  private final SpaceRepository spaceRepository;
  private final MemberService memberService;
  private final DocumentSnapshotRepository snapshotRepository;
  private final Clock clock;

  // 문서 자신이나 소속 공간이 삭제됐으면 없는 문서로 취급
  @Transactional(readOnly = true)
  public Document getLiveDocument(Long id) {
    Document doc = documentRepository.findById(id)
      .filter(d -> !d.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    getLiveSpace(doc.getSpaceId());
    return doc;
  }

  @Transactional(readOnly = true)
  public DocumentDetail getDetail(Long id) {
    Document doc = getLiveDocument(id);
    Space space = getLiveSpace(doc.getSpaceId());
    Map<Long, String> names = memberService.findNamesByIds(
      new HashSet<>(List.of(doc.getCreatedBy(), doc.getUpdatedBy())));
    return DocumentDetail.from(doc, space.getName(),
      names.getOrDefault(doc.getCreatedBy(), ""), names.getOrDefault(doc.getUpdatedBy(), ""));
  }

  @Transactional(readOnly = true)
  public List<DocumentSummary> findBySpace(Long spaceId) {
    getLiveSpace(spaceId);
    return toSummaries(
      documentRepository.findBySpaceIdAndDeletedAtIsNullOrderByUpdatedAtDesc(spaceId));
  }

  @Transactional
  public DocumentSummary create(Long spaceId, String title, Long userId) {
    Space space = getLiveSpace(spaceId);
    // 비어 있는 제목은 기본 제목 사용
    String resolved = title == null || title.isBlank() ? Document.DEFAULT_TITLE : title.trim();
    Document saved = documentRepository.save(Document.create(spaceId, resolved, userId));
    Map<Long, String> names = memberService.findNamesByIds(Set.of(userId));
    return DocumentSummary.from(saved, space.getName(), names.getOrDefault(userId, ""));
  }

  // 제목 수정 시 수정자와 수정 시각 갱신
  @Transactional
  public DocumentDetail rename(Long id, String title, Long userId) {
    getLiveDocument(id).rename(title.trim(), userId);
    return getDetail(id);
  }

  @Transactional
  public void delete(Long id) {
    getLiveDocument(id).softDelete();
  }

  @Transactional
  public void restore(Long id) {
    Document doc = documentRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    doc.restore();
  }

  // 협업 서버의 본문 저장, 마지막 스냅샷이 없거나 10분 이상 지났으면 스냅샷 추가
  @Transactional
  public void saveContent(Long id, byte[] state, String plainText, Long updatedBy) {
    Document doc = getLiveDocument(id);
    // 수정자가 없거나 존재하지 않는 팀원이면 기존 수정자 유지
    boolean knownEditor = updatedBy != null
      && memberService.findNamesByIds(Set.of(updatedBy)).containsKey(updatedBy);
    doc.updateContent(state, plainText, knownEditor ? updatedBy : doc.getUpdatedBy());
    Instant now = Instant.now(clock);
    boolean needSnapshot = snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(id)
      .map(last -> !last.getCreatedAt().plus(SNAPSHOT_INTERVAL).isAfter(now))
      .orElse(true);
    if (needSnapshot) {
      snapshotRepository.save(DocumentSnapshot.create(id, state, now));
    }
  }

  // 2자 미만 검색어는 빈 목록
  @Transactional(readOnly = true)
  public List<DocumentSummary> search(String q) {
    String query = q == null ? "" : q.trim();
    if (query.length() < MIN_QUERY_LENGTH) {
      return List.of();
    }
    return toSummaries(documentRepository.search("%" + escapeLike(query) + "%"));
  }

  @Transactional(readOnly = true)
  public TrashResponse findTrash() {
    List<TrashItem> spaces = spaceRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc().stream()
      .map(s -> new TrashItem(s.getId(), s.getName(), s.getDeletedAt().atOffset(ZoneOffset.UTC)))
      .toList();
    List<TrashItem> documents = documentRepository.findTrashed().stream()
      .map(d -> new TrashItem(d.getId(), d.getTitle(), d.getDeletedAt().atOffset(ZoneOffset.UTC)))
      .toList();
    return new TrashResponse(spaces, documents);
  }

  private Space getLiveSpace(Long spaceId) {
    return spaceRepository.findById(spaceId)
      .filter(s -> !s.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  // 공간명과 수정자 이름을 한 번에 조회해 요약 목록 생성
  private List<DocumentSummary> toSummaries(List<Document> docs) {
    if (docs.isEmpty()) {
      return List.of();
    }
    Set<Long> spaceIds = docs.stream().map(Document::getSpaceId).collect(Collectors.toSet());
    Map<Long, String> spaceNames = spaceRepository.findAllById(spaceIds).stream()
      .collect(Collectors.toMap(Space::getId, Space::getName));
    Set<Long> userIds = new HashSet<>();
    docs.forEach(d -> userIds.add(d.getUpdatedBy()));
    Map<Long, String> names = memberService.findNamesByIds(userIds);
    return docs.stream()
      .map(d -> DocumentSummary.from(d, spaceNames.getOrDefault(d.getSpaceId(), ""),
        names.getOrDefault(d.getUpdatedBy(), "")))
      .toList();
  }

  // LIKE 와일드카드 문자를 일반 문자로 처리
  private String escapeLike(String value) {
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }
}
