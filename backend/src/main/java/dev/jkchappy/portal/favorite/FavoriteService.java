package dev.jkchappy.portal.favorite;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.favorite.dto.FavoriteResponse;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 팀원별 즐겨찾는 페이지 관리 (본인 목록만 보고 바꿈)
@Service
@RequiredArgsConstructor
public class FavoriteService {

  private final DocumentFavoriteRepository favoriteRepository;
  private final DocumentRepository documentRepository;
  private final SpaceRepository spaceRepository;
  private final Clock clock;

  // 휴지통에 있는 페이지·프로젝트는 숨기고 순서대로 반환 (복원하면 다시 보임)
  @Transactional(readOnly = true)
  public List<FavoriteResponse> list(Long memberId) {
    List<DocumentFavorite> favorites = favoriteRepository.findByMemberIdOrderBySortOrderAscCreatedAtAsc(memberId);
    Map<Long, Document> docs = documentRepository.findAllById(
        favorites.stream().map(DocumentFavorite::getDocumentId).toList()).stream()
      .collect(Collectors.toMap(Document::getId, Function.identity()));
    Map<Long, Space> spaces = spaceRepository.findAllById(
        docs.values().stream().map(Document::getSpaceId).distinct().toList()).stream()
      .collect(Collectors.toMap(Space::getId, Function.identity()));
    List<FavoriteResponse> result = new ArrayList<>();
    for (DocumentFavorite favorite : favorites) {
      Document doc = docs.get(favorite.getDocumentId());
      Space space = doc == null ? null : spaces.get(doc.getSpaceId());
      if (doc == null || doc.isDeleted() || space == null || space.isDeleted()) {
        continue;
      }
      boolean home = space.isHomeDocument(doc.getId());
      result.add(new FavoriteResponse(doc.getId(), doc.getSpaceId(), home ? space.getName() : doc.getTitle(),
        doc.getIcon(), doc.getKind(), home));
    }
    return result;
  }

  // 맨 아래에 추가 (이미 있으면 그대로)
  @Transactional
  public List<FavoriteResponse> add(Long memberId, Long documentId) {
    Document doc = documentRepository.findById(documentId)
      .filter(d -> !d.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "페이지를 찾을 수 없습니다."));
    if (!favoriteRepository.existsById(new DocumentFavoriteKey(memberId, doc.getId()))) {
      int next = favoriteRepository.findByMemberIdOrderBySortOrderAscCreatedAtAsc(memberId).stream()
        .mapToInt(DocumentFavorite::getSortOrder)
        .max()
        .orElse(-1) + 1;
      favoriteRepository.save(DocumentFavorite.of(memberId, doc.getId(), next, clock.instant()));
    }
    return list(memberId);
  }

  // 없는 즐겨찾기를 빼도 오류 없이 현재 목록 반환
  @Transactional
  public List<FavoriteResponse> remove(Long memberId, Long documentId) {
    favoriteRepository.findById(new DocumentFavoriteKey(memberId, documentId))
      .ifPresent(favoriteRepository::delete);
    return list(memberId);
  }

  // 보이는 목록 기준 index 위치로 옮기고 0부터 다시 번호를 매김 (휴지통에 있어 숨겨진 항목은 맨 뒤로)
  @Transactional
  public List<FavoriteResponse> move(Long memberId, Long documentId, int index) {
    List<Long> order = new ArrayList<>(list(memberId).stream().map(FavoriteResponse::documentId).toList());
    if (!order.remove(documentId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, "즐겨찾기에 없는 페이지입니다.");
    }
    order.add(Math.min(index, order.size()), documentId);
    Map<Long, DocumentFavorite> favorites = favoriteRepository.findByMemberIdOrderBySortOrderAscCreatedAtAsc(memberId)
      .stream()
      .collect(Collectors.toMap(DocumentFavorite::getDocumentId, Function.identity()));
    int sort = 0;
    for (Long id : order) {
      favorites.remove(id).changeOrder(sort++);
    }
    for (DocumentFavorite hidden : favorites.values()) {
      hidden.changeOrder(sort++);
    }
    return list(memberId);
  }
}
