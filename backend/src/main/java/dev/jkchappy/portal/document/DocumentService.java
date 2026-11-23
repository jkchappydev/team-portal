package dev.jkchappy.portal.document;

import dev.jkchappy.portal.attachment.Attachment;
import dev.jkchappy.portal.attachment.AttachmentRepository;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.DocumentDetail;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import dev.jkchappy.portal.document.dto.PageRef;
import dev.jkchappy.portal.document.dto.RecentDocument;
import dev.jkchappy.portal.document.dto.TrashChild;
import dev.jkchappy.portal.document.dto.TrashItem;
import dev.jkchappy.portal.document.dto.TrashResponse;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
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
  private final AttachmentRepository attachmentRepository;
  private final Clock clock;

  // 하위 페이지 최대 깊이 (순환 데이터 방어)
  private static final int MAX_DEPTH = 50;

  // 상위 페이지가 없는(프로젝트 최상위) 페이지를 묶는 키
  private static final Long ROOT_KEY = 0L;

  // 페이지 자신이나 상위 페이지, 소속 프로젝트가 삭제됐으면 없는 페이지로 취급
  @Transactional(readOnly = true)
  public Document getLiveDocument(Long id) {
    Document doc = documentRepository.findById(id)
      .filter(d -> !d.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    getLiveSpace(doc.getSpaceId());
    ancestors(doc).forEach(ancestor -> {
      if (ancestor.isDeleted()) {
        throw new BusinessException(ErrorCode.NOT_FOUND);
      }
    });
    return doc;
  }

  // 바로 위 페이지부터 최상위까지 (순환 데이터 방어로 최대 깊이 제한)
  private List<Document> ancestors(Document doc) {
    List<Document> result = new ArrayList<>();
    Long parentId = doc.getParentId();
    while (parentId != null && result.size() < MAX_DEPTH) {
      Document parent = documentRepository.findById(parentId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
      result.add(parent);
      parentId = parent.getParentId();
    }
    return result;
  }

  @Transactional(readOnly = true)
  public DocumentDetail getDetail(Long id) {
    Document doc = getLiveDocument(id);
    Space space = getLiveSpace(doc.getSpaceId());
    Map<Long, String> names = memberService.findNamesByIds(
      new HashSet<>(List.of(doc.getCreatedBy(), doc.getUpdatedBy())));
    return DocumentDetail.from(doc, space.getName(),
      names.getOrDefault(doc.getCreatedBy(), ""), names.getOrDefault(doc.getUpdatedBy(), ""),
      space.isHomeDocument(doc.getId()),
      ancestors(doc).reversed().stream().map(a -> new PageRef(a.getId(), a.getTitle(), a.getIcon())).toList());
  }

  // 프로젝트의 전체 페이지 트리 (본문 페이지 제외, 삭제된 페이지의 하위 페이지도 제외)
  @Transactional(readOnly = true)
  public List<DocumentSummary> findBySpace(Long spaceId) {
    Space space = getLiveSpace(spaceId);
    List<Document> live =
      documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(spaceId).stream()
        .filter(doc -> !space.isHomeDocument(doc.getId()))
        // WBS는 페이지 본문 일정 블록의 데이터 저장소라 트리에 보이지 않음
        .filter(doc -> !doc.isWbs())
        .toList();
    Map<Long, Document> byId = live.stream().collect(Collectors.toMap(Document::getId, d -> d));
    return toSummaries(live.stream().filter(doc -> reachable(doc, byId)).toList());
  }

  // 상위 페이지를 따라 올라가 모두 살아 있는 목록 안에 있으면 표시 대상
  private boolean reachable(Document doc, Map<Long, Document> byId) {
    Long parentId = doc.getParentId();
    int depth = 0;
    while (parentId != null) {
      Document parent = byId.get(parentId);
      if (parent == null || ++depth > MAX_DEPTH) {
        return false;
      }
      parentId = parent.getParentId();
    }
    return true;
  }

  @Transactional
  public DocumentSummary create(Long spaceId, String title, Long parentId, Long userId) {
    return create(spaceId, title, parentId, DocumentKind.PAGE, userId);
  }

  // 페이지 또는 WBS 생성 (파일 항목은 업로드 경로로만 생성)
  @Transactional
  public DocumentSummary create(Long spaceId, String title, Long parentId, DocumentKind kind, Long userId) {
    if (kind == DocumentKind.FILE) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "파일은 업로드로만 추가할 수 있습니다.");
    }
    Space space = getLiveSpace(spaceId);
    // 비어 있는 제목은 기본 제목 사용
    String resolved = title == null || title.isBlank() ? Document.DEFAULT_TITLE : title.trim();
    Document doc = kind == DocumentKind.WBS
      ? Document.createWbs(spaceId, resolved, userId)
      : Document.create(spaceId, resolved, userId);
    Document saved = placeAndSave(space, doc, parentId);
    Map<Long, String> names = memberService.findNamesByIds(Set.of(userId));
    return DocumentSummary.from(saved, space.getName(), names.getOrDefault(userId, ""));
  }

  // 본문 페이지 블록 복제: 같은 상위의 맨 아래에 제목·아이콘·본문을 복사한 새 페이지 생성
  // (본문 안의 하위 페이지 블록은 원래 하위 페이지를 그대로 가리킴)
  @Transactional
  public DocumentSummary duplicate(Long id, Long userId) {
    return duplicate(id, userId, null);
  }

  // targetParentId: 사본을 둘 상위 페이지 (본문에 복사해 붙여넣은 페이지, 다른 프로젝트 본문도 가능), null이면 원본과 같은 자리 (그때만 제목 뒤 "(사본)")
  @Transactional
  public DocumentSummary duplicate(Long id, Long userId, Long targetParentId) {
    Document source = getLiveDocument(id);
    Space sourceSpace = getLiveSpace(source.getSpaceId());
    if (!source.isPage() || sourceSpace.isHomeDocument(id)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "페이지만 복제할 수 있습니다.");
    }
    Long parentId = targetParentId == null ? source.getParentId() : targetParentId;
    Space space = targetParentId == null ? sourceSpace : getLiveSpace(getLiveDocument(targetParentId).getSpaceId());
    // "(사본)"은 블록 메뉴 복제(같은 자리)에만, 다른 곳에 복사해 붙여넣은 페이지는 원래 제목 그대로
    String title = targetParentId == null ? copyTitle(source.getTitle()) : source.getTitle();
    Document copy = Document.copyOf(source, title, userId);
    copy.moveToSpace(space.getId());
    Document saved = placeAndSave(space, copy, parentId);
    Map<Long, String> names = memberService.findNamesByIds(Set.of(userId));
    return DocumentSummary.from(saved, space.getName(), names.getOrDefault(userId, ""));
  }

  private static final String COPY_SUFFIX = " (사본)";
  private static final int MAX_TITLE_LENGTH = 200;

  // 원래 제목 뒤에 "(사본)", 제목 길이 제한을 넘으면 원래 제목을 잘라 맞춤
  private static String copyTitle(String title) {
    int room = MAX_TITLE_LENGTH - COPY_SUFFIX.length();
    String base = title.length() > room ? title.substring(0, room) : title;
    return base + COPY_SUFFIX;
  }

  // 사이드바에 끌어다 놓은 파일 항목 생성 (파일 본체는 호출한 쪽에서 업로드 후 연결)
  @Transactional
  public Document createFile(Long spaceId, String fileName, Long parentId, Long userId) {
    Space space = getLiveSpace(spaceId);
    return placeAndSave(space, Document.createFile(spaceId, fileName, userId), parentId);
  }

  // 파일 항목에 업로드한 파일 본체 연결
  @Transactional
  public void attachFile(Long id, Long attachmentId) {
    getLiveDocument(id).attachFile(attachmentId);
  }

  @Transactional(readOnly = true)
  public DocumentSummary getSummary(Long id) {
    return toSummaries(List.of(getLiveDocument(id))).get(0);
  }

  // 최상위 본문 아래는 최상위, 그 외에는 같은 최상위 페이지 안의 살아 있는 페이지 아래에 두고 맨 아래 순서로 저장
  private Document placeAndSave(Space space, Document doc, Long parentId) {
    if (parentId != null && !space.isHomeDocument(parentId)) {
      checkParent(getLiveDocument(parentId), space.getId());
      doc.placeUnder(parentId);
    }
    doc.changeSortOrder(siblingsOf(space.getId(), doc.getParentId(), null).stream()
      .mapToInt(Document::getSortOrder).max().orElse(-1) + 1);
    return documentRepository.save(doc);
  }

  // 상위가 될 수 있는 것은 같은 최상위 페이지 안의 페이지뿐 (파일·WBS 아래에는 둘 수 없음)
  private void checkParent(Document parent, Long spaceId) {
    if (!parent.getSpaceId().equals(spaceId)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "다른 최상위 페이지 안으로는 넣을 수 없습니다.");
    }
    if (parent.isFile()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "파일 안에는 넣을 수 없습니다.");
    }
    if (parent.isWbs()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "WBS 안에는 넣을 수 없습니다.");
    }
  }

  // 제목 수정 시 수정자와 수정 시각 갱신
  @Transactional
  public DocumentDetail rename(Long id, String title, Long userId) {
    Document doc = getLiveDocument(id);
    String resolved = title.trim();
    doc.rename(resolved, userId);
    // 본문 페이지 제목은 프로젝트 이름과 같게 유지
    Space space = getLiveSpace(doc.getSpaceId());
    if (space.isHomeDocument(id)) {
      space.change(resolved, space.getDescription());
    }
    return getDetail(id);
  }

  // 페이지를 다른 페이지 아래(또는 프로젝트 최상위)의 index 위치로 이동, 하위 페이지는 함께 따라옴
  // index가 없으면 새 상위 페이지 안의 맨 아래
  @Transactional
  public DocumentDetail move(Long id, Long parentId, Integer index) {
    Document doc = getLiveDocument(id);
    Space space = getLiveSpace(doc.getSpaceId());
    if (space.isHomeDocument(id)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "최상위 페이지 본문은 옮길 수 없습니다.");
    }
    // 새 상위가 다른 프로젝트(본문 포함)에 있으면 그 프로젝트로 옮김 (본문에서 잘라내 다른 프로젝트에 붙여넣은 경우)
    Space target = parentId == null ? space : getLiveSpace(getLiveDocument(parentId).getSpaceId());
    // 최상위 페이지 본문 아래로 옮기면 최상위
    Long resolved = parentId == null || target.isHomeDocument(parentId) ? null : parentId;
    if (resolved != null) {
      if (resolved.equals(id)) {
        throw new BusinessException(ErrorCode.INVALID_INPUT, "자기 자신 아래로는 옮길 수 없습니다.");
      }
      Document parent = getLiveDocument(resolved);
      checkParent(parent, target.getId());
      // 새 상위의 경로에 자신이 있으면 자기 하위 페이지 안으로 옮기는 것이라 순환이 생김
      if (ancestors(parent).stream().anyMatch(a -> a.getId().equals(id))) {
        throw new BusinessException(ErrorCode.INVALID_INPUT, "하위 페이지 안으로는 옮길 수 없습니다.");
      }
    }
    if (!target.getId().equals(space.getId())) {
      // 하위 페이지(휴지통에 있는 것 포함)도 함께 새 프로젝트로
      for (Document moved : subtreeOf(doc)) {
        moved.moveToSpace(target.getId());
      }
    }
    doc.placeUnder(resolved);
    // 새 상위 페이지 안의 형제들 사이에 끼워 넣고 0부터 다시 번호를 매김
    List<Document> siblings = new ArrayList<>(siblingsOf(target.getId(), resolved, id));
    int position = index == null ? siblings.size() : Math.clamp(index, 0, siblings.size());
    siblings.add(position, doc);
    for (int i = 0; i < siblings.size(); i++) {
      siblings.get(i).changeSortOrder(i);
    }
    return getDetail(id);
  }

  // 기존 하위 항목을 본문 페이지 블록으로 붙일 목록을 한 번만 가져감 (처음이면 하위 PAGE·FILE ID를 표시 순서대로, 이후 빈 목록)
  // 프로젝트 본문(home)이면 프로젝트 최상위 항목, WBS는 이미 본문에 일정 블록이 있어 제외
  @Transactional
  public List<Long> claimPageBlockBackfill(Long id) {
    Document doc = getLiveDocument(id);
    if (documentRepository.claimPageBlockBackfill(id) == 0) {
      return List.of();
    }
    Space space = getLiveSpace(doc.getSpaceId());
    Long parentId = space.isHomeDocument(id) ? null : id;
    return siblingsOf(doc.getSpaceId(), parentId, null).stream()
      .filter(d -> d.isPage() || d.isFile())
      .map(Document::getId)
      .toList();
  }

  // 같은 상위 페이지 아래의 살아 있는 페이지를 표시 순서대로 (프로젝트 본문과 excludedId 제외)
  // 자신과 모든 하위 페이지 (상위 참조를 따라 내려감, 순환 데이터 방어로 한 번씩만)
  private List<Document> subtreeOf(Document root) {
    Map<Long, List<Document>> childrenByParent = documentRepository.findBySpaceId(root.getSpaceId()).stream()
      .filter(d -> d.getParentId() != null)
      .collect(Collectors.groupingBy(Document::getParentId));
    List<Document> result = new ArrayList<>();
    Set<Long> seen = new HashSet<>();
    Deque<Document> queue = new ArrayDeque<>(List.of(root));
    while (!queue.isEmpty()) {
      Document current = queue.poll();
      if (seen.add(current.getId())) {
        result.add(current);
        queue.addAll(childrenByParent.getOrDefault(current.getId(), List.of()));
      }
    }
    return result;
  }

  private List<Document> siblingsOf(Long spaceId, Long parentId, Long excludedId) {
    Space space = getLiveSpace(spaceId);
    return documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(spaceId)
      .stream()
      .filter(d -> Objects.equals(d.getParentId(), parentId))
      .filter(d -> !space.isHomeDocument(d.getId()) && !d.getId().equals(excludedId))
      .toList();
  }

  // 아이콘 변경 (비어 있으면 제거)
  @Transactional
  public DocumentDetail changeIcon(Long id, String icon, Long userId) {
    Document doc = getLiveDocument(id);
    String resolved = icon == null || icon.isBlank() ? null : icon.trim();
    if (resolved != null) validateIcon(doc, resolved);
    doc.changeIcon(resolved, userId);
    return getDetail(id);
  }

  private static final long MAX_ICON_IMAGE_BYTES = 5L * 1024 * 1024;
  private static final java.util.regex.Pattern UPLOADED_ICON = java.util.regex.Pattern.compile("att:(\\d{1,18})");

  // 업로드 이미지는 같은 페이지의 5MB 이하 이미지(SVG 제외)만, 주소는 https만, 그 외는 짧은 이모지 글자만 허용
  private void validateIcon(Document doc, String icon) {
    if (validateImageValue(doc, icon, "아이콘으로 쓸 수 없는 이미지입니다.")) return;
    if (icon.length() > 32 || icon.contains(":")) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "이모지나 이미지만 아이콘으로 쓸 수 있습니다.");
    }
  }

  // 업로드 이미지(att:{ID})나 https 주소면 검사 후 true, 이미지 값이 아니면 false
  private boolean validateImageValue(Document doc, String value, String unusableMessage) {
    var uploaded = UPLOADED_ICON.matcher(value);
    if (uploaded.matches()) {
      boolean usable = attachmentRepository.findById(Long.parseLong(uploaded.group(1)))
        .filter(a -> a.getDocumentId().equals(doc.getId()))
        .filter(a -> isIconImage(a))
        .isPresent();
      if (!usable) throw new BusinessException(ErrorCode.INVALID_INPUT, unusableMessage);
      return true;
    }
    if (value.startsWith("https://")) {
      try {
        var uri = new java.net.URI(value);
        if (uri.getHost() != null && !uri.getHost().isBlank()) return true;
      } catch (java.net.URISyntaxException ignored) {
        // 아래에서 잘못된 주소로 처리
      }
      throw new BusinessException(ErrorCode.INVALID_INPUT, "이미지 주소가 올바르지 않습니다.");
    }
    return false;
  }

  private static final int MAX_COVER_LENGTH = 512;

  // 프로젝트 본문 커버 변경 (비어 있으면 제거, 업로드 이미지·https 이미지 주소만 허용)
  @Transactional
  public DocumentDetail changeCover(Long id, String cover, Long userId) {
    Document doc = getLiveDocument(id);
    Space coverSpace = getLiveSpace(doc.getSpaceId());
    if (!coverSpace.isHomeDocument(id) || !coverSpace.isProject()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "프로젝트에만 커버를 넣을 수 있습니다.");
    }
    String resolved = cover == null || cover.isBlank() ? null : cover.trim();
    if (resolved != null && (resolved.length() > MAX_COVER_LENGTH
      || !validateImageValue(doc, resolved, "커버로 쓸 수 없는 이미지입니다."))) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "이미지만 커버로 쓸 수 있습니다.");
    }
    doc.changeCover(resolved, userId);
    return getDetail(id);
  }

  private static boolean isIconImage(Attachment attachment) {
    String type = attachment.getContentType();
    return type.startsWith("image/") && !type.startsWith("image/svg") && attachment.getSize() <= MAX_ICON_IMAGE_BYTES;
  }

  // 프로젝트 본문 페이지는 프로젝트 삭제로만 지울 수 있음
  @Transactional
  public void delete(Long id) {
    Document doc = getLiveDocument(id);
    if (getLiveSpace(doc.getSpaceId()).isHomeDocument(id)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "최상위 페이지 본문은 최상위 페이지를 삭제해야 지울 수 있습니다.");
    }
    doc.softDelete();
  }

  @Transactional
  public void restore(Long id) {
    Document doc = documentRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    // 프로젝트가 삭제된 상태면 페이지를 둘 곳이 없으므로 프로젝트 복원이 먼저
    Space space = spaceRepository.findById(doc.getSpaceId())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (space.isDeleted()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "최상위 페이지를 먼저 복원하세요.");
    }
    // 삭제된 페이지면 되살리고, 상위 삭제로 함께 숨겨진 페이지면 위치만 옮김
    doc.restore();
    relocateUnderLiveAncestor(doc);
  }

  // 상위 경로에 삭제된 페이지가 있으면 그 위에서 가장 가까운 살아 있는 페이지 아래로 옮김
  // (모두 삭제됐거나 상위를 찾을 수 없으면 프로젝트 최상위, 하위 페이지는 그대로 따라옴)
  private void relocateUnderLiveAncestor(Document doc) {
    List<Document> chain = new ArrayList<>();
    Long parentId = doc.getParentId();
    while (parentId != null && chain.size() < MAX_DEPTH) {
      Document parent = documentRepository.findById(parentId).orElse(null);
      if (parent == null) {
        doc.placeUnder(null);
        return;
      }
      chain.add(parent);
      parentId = parent.getParentId();
    }
    // 최상위부터 내려오며 처음 삭제된 페이지 바로 위가 새 상위
    Long newParentId = null;
    for (Document ancestor : chain.reversed()) {
      if (ancestor.isDeleted()) {
        doc.placeUnder(newParentId);
        return;
      }
      newParentId = ancestor.getId();
    }
  }

  // 협업 서버의 본문 저장, 마지막 스냅샷이 없거나 10분 이상 지났으면 스냅샷 추가
  @Transactional
  public void saveContent(Long id, byte[] state, String plainText, Long updatedBy) {
    Document doc = getLiveDocument(id);
    // 파일 항목은 공동 편집 본문이 없으므로 거부 (WBS는 표 아래 본문을 공동 편집)
    if (doc.isFile()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "본문을 편집할 수 없는 항목입니다.");
    }
    // 수정자가 없거나 존재하지 않는 팀원이면 기존 수정자 유지
    boolean knownEditor = updatedBy != null
      && memberService.findNamesByIds(Set.of(updatedBy)).containsKey(updatedBy);
    doc.updateContent(state, plainText, knownEditor ? updatedBy : doc.getUpdatedBy());
    Instant now = Instant.now(clock);
    boolean needSnapshot = snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(id)
      .map(last -> !last.getCreatedAt().plus(SNAPSHOT_INTERVAL).isAfter(now))
      .orElse(true);
    if (needSnapshot) {
      snapshotRepository.save(DocumentSnapshot.create(id, state, now, doc.getUpdatedBy(), SnapshotReason.AUTO));
    }
  }

  // 2자 미만 검색어는 빈 목록
  @Transactional(readOnly = true)
  public List<DocumentSummary> search(String q) {
    String query = q == null ? "" : q.trim();
    if (query.length() < MIN_QUERY_LENGTH) {
      return List.of();
    }
    // 상위 페이지가 삭제된 페이지는 검색 결과에서 제외
    return summarizeVisible(documentRepository.search("%" + escapeLike(query) + "%"));
  }

  // 삭제된 프로젝트와 페이지를 최근 삭제순으로 합치고, 각 항목 아래에 함께 숨겨진 하위 페이지를 붙임
  @Transactional(readOnly = true)
  public TrashResponse findTrash() {
    // 프로젝트별 살아 있는 페이지를 상위 페이지 ID로 묶어 한 번만 조회
    Map<Long, Map<Long, List<Document>>> childrenBySpace = new HashMap<>();
    Function<Long, Map<Long, List<Document>>> childrenOf = spaceId ->
      childrenBySpace.computeIfAbsent(spaceId, id -> documentRepository
        .findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(id).stream()
        .collect(Collectors.groupingBy(d -> d.getParentId() == null ? ROOT_KEY : d.getParentId(),
          LinkedHashMap::new, Collectors.toList())));

    List<TrashItem> items = new ArrayList<>();
    for (Space space : spaceRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc()) {
      Long homeId = space.getHomeDocumentId();
      String icon = homeId == null ? null
        : documentRepository.findById(homeId).map(Document::getIcon).orElse(null);
      List<TrashChild> children = new ArrayList<>();
      // 프로젝트 본문 페이지는 프로젝트 자신이므로 하위 목록에서 제외
      collectChildren(childrenOf.apply(space.getId()), ROOT_KEY, homeId, 1, children);
      items.add(new TrashItem("space", space.getId(), space.getName(), icon, space.getKind().name(),
        space.getDeletedAt().atOffset(ZoneOffset.UTC), children));
    }
    for (Document doc : documentRepository.findTrashed().stream().filter(d -> !d.isWbs()).toList()) {
      List<TrashChild> children = new ArrayList<>();
      collectChildren(childrenOf.apply(doc.getSpaceId()), doc.getId(), null, 1, children);
      items.add(new TrashItem("document", doc.getId(), doc.getTitle(), doc.getIcon(), null,
        doc.getDeletedAt().atOffset(ZoneOffset.UTC), children));
    }
    items.sort(Comparator.comparing(TrashItem::deletedAt).reversed());
    return new TrashResponse(items);
  }

  // 상위 페이지 아래를 깊이 우선으로 펼침 (순환 데이터 방어로 최대 깊이 제한)
  private void collectChildren(Map<Long, List<Document>> byParent, Long parentKey, Long excludedId,
    int depth, List<TrashChild> result) {
    if (depth > MAX_DEPTH) {
      return;
    }
    for (Document child : byParent.getOrDefault(parentKey, List.of())) {
      // 본문 일정 블록의 WBS는 페이지와 함께 숨겨지고 복원되므로 따로 표시하지 않음
      if (child.getId().equals(excludedId) || child.isWbs()) {
        continue;
      }
      result.add(new TrashChild(child.getId(), child.getTitle(), child.getIcon(), depth));
      collectChildren(byParent, child.getId(), excludedId, depth + 1, result);
    }
  }

  private Space getLiveSpace(Long spaceId) {
    return spaceRepository.findById(spaceId)
      .filter(s -> !s.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  // 상위 페이지가 삭제돼 숨겨진 문서를 빼고 요약 목록으로 변환
  @Transactional(readOnly = true)
  public List<DocumentSummary> summarizeVisible(List<Document> docs) {
    return toSummaries(docs.stream()
      .filter(doc -> ancestors(doc).stream().noneMatch(Document::isDeleted))
      .toList());
  }

  // 메인 화면 최근 수정된 게시글: 최근 수정한 페이지·파일과 마지막 수정자 (상위 페이지가 휴지통에 있으면 제외)
  @Transactional(readOnly = true)
  public List<RecentDocument> findRecent(int limit) {
    List<Document> docs = documentRepository.findRecentlyUpdated(limit).stream()
      .filter(doc -> ancestors(doc).stream().noneMatch(Document::isDeleted))
      .toList();
    if (docs.isEmpty()) {
      return List.of();
    }
    Map<Long, String> spaceNames = spaceRepository.findAllById(
        docs.stream().map(Document::getSpaceId).collect(Collectors.toSet())).stream()
      .collect(Collectors.toMap(Space::getId, Space::getName));
    Map<Long, String> names = memberService.findNamesByIds(
      docs.stream().map(Document::getUpdatedBy).collect(Collectors.toSet()));
    return docs.stream()
      .map(d -> RecentDocument.from(d, spaceNames.getOrDefault(d.getSpaceId(), ""),
        names.getOrDefault(d.getUpdatedBy(), "")))
      .toList();
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
