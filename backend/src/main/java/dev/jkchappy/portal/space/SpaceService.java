package dev.jkchappy.portal.space;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.space.dto.SpaceRequest;
import dev.jkchappy.portal.space.dto.SpaceResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SpaceService {

  private final SpaceRepository spaceRepository;
  private final DocumentRepository documentRepository;

  // 삭제되지 않은 공간을 문서 수와 함께 조회
  @Transactional(readOnly = true)
  public List<SpaceResponse> findAll() {
    List<Space> spaces = spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc();
    if (spaces.isEmpty()) {
      return List.of();
    }
    Map<Long, Long> counts = new HashMap<>();
    documentRepository.countLiveBySpaceIds(spaces.stream().map(Space::getId).toList())
      .forEach(row -> counts.put((Long) row[0], (Long) row[1]));
    // 프로젝트 아이콘은 본문 페이지 아이콘을 사용
    Map<Long, String> icons = new HashMap<>();
    documentRepository.findAllById(spaces.stream().map(Space::getHomeDocumentId)
        .filter(Objects::nonNull).toList())
      .forEach(home -> {
        if (home.getIcon() != null) {
          icons.put(home.getId(), home.getIcon());
        }
      });
    return spaces.stream()
      .map(s -> SpaceResponse.from(s, counts.getOrDefault(s.getId(), 0L), icons.get(s.getHomeDocumentId())))
      .toList();
  }

  // 프로젝트와 같은 이름의 본문 페이지를 함께 생성
  @Transactional
  public SpaceResponse create(SpaceRequest request, Long userId) {
    String name = request.name().trim();
    Space space = Space.create(name, request.description(), userId);
    // 새 최상위 페이지는 사이드바 맨 아래
    space.changeSortOrder(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc().stream()
      .mapToInt(Space::getSortOrder).max().orElse(-1) + 1);
    Space saved = spaceRepository.save(space);
    Document home = documentRepository.save(Document.create(saved.getId(), name, userId));
    saved.assignHomeDocument(home.getId());
    return SpaceResponse.from(saved, 0, null);
  }

  // 사이드바에서 끌어 옮긴 최상위 페이지를 index 위치에 끼워 넣고 0부터 다시 번호를 매김
  @Transactional
  public void move(Long id, int index) {
    Space target = getLiveSpace(id);
    List<Space> spaces = new ArrayList<>(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc()
      .stream().filter(s -> !s.getId().equals(id)).toList());
    spaces.add(Math.clamp(index, 0, spaces.size()), target);
    for (int i = 0; i < spaces.size(); i++) {
      spaces.get(i).changeSortOrder(i);
    }
  }

  // 이름 변경 시 본문 페이지 제목도 같이 맞춤
  @Transactional
  public SpaceResponse update(Long id, SpaceRequest request) {
    Space space = getLiveSpace(id);
    String name = request.name().trim();
    space.change(name, request.description());
    Document home = space.getHomeDocumentId() == null ? null
      : documentRepository.findById(space.getHomeDocumentId()).orElse(null);
    if (home != null) {
      home.changeTitle(name);
    }
    long count = documentRepository.countLiveBySpaceIds(List.of(id)).stream()
      .mapToLong(row -> (Long) row[1]).sum();
    return SpaceResponse.from(space, count, home == null ? null : home.getIcon());
  }

  // 하위 문서는 그대로 두고 공간만 삭제 처리
  @Transactional
  public void delete(Long id) {
    getLiveSpace(id).softDelete();
  }

  @Transactional
  public void restore(Long id) {
    Space space = spaceRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    space.restore();
  }

  private Space getLiveSpace(Long id) {
    return spaceRepository.findById(id)
      .filter(s -> !s.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }
}
