package dev.jkchappy.portal.space;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.space.dto.SpaceRequest;
import dev.jkchappy.portal.space.dto.SpaceResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    List<Space> spaces = spaceRepository.findByDeletedAtIsNullOrderByNameAscIdAsc();
    if (spaces.isEmpty()) {
      return List.of();
    }
    Map<Long, Long> counts = new HashMap<>();
    documentRepository.countLiveBySpaceIds(spaces.stream().map(Space::getId).toList())
      .forEach(row -> counts.put((Long) row[0], (Long) row[1]));
    return spaces.stream()
      .map(s -> SpaceResponse.from(s, counts.getOrDefault(s.getId(), 0L)))
      .toList();
  }

  @Transactional
  public SpaceResponse create(SpaceRequest request, Long userId) {
    Space saved = spaceRepository.save(
      Space.create(request.name().trim(), request.description(), userId));
    return SpaceResponse.from(saved, 0);
  }

  @Transactional
  public SpaceResponse update(Long id, SpaceRequest request) {
    Space space = getLiveSpace(id);
    space.change(request.name().trim(), request.description());
    long count = documentRepository.countLiveBySpaceIds(List.of(id)).stream()
      .mapToLong(row -> (Long) row[1]).sum();
    return SpaceResponse.from(space, count);
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
