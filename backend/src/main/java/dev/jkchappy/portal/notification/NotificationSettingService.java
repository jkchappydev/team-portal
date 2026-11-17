package dev.jkchappy.portal.notification;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.notification.dto.NotificationSettingResponse;
import dev.jkchappy.portal.space.SpaceRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 내 알림 설정: 프로젝트(최상위 페이지 포함)마다 모든 게시글·담당 언급·끄기 중 하나
@Service
@RequiredArgsConstructor
public class NotificationSettingService {

  private final NotificationSettingRepository settingRepository;
  private final SpaceRepository spaceRepository;

  // 살아 있는 프로젝트 전체를 사이드바 순서로, 저장하지 않은 프로젝트는 모든 게시글
  @Transactional(readOnly = true)
  public List<NotificationSettingResponse> findMine(Long memberId) {
    Map<Long, NotificationLevel> saved = settingRepository.findByMemberId(memberId).stream()
      .collect(Collectors.toMap(NotificationSetting::getSpaceId, NotificationSetting::getLevel));
    return spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc().stream()
      .map(space -> new NotificationSettingResponse(space.getId(),
        saved.getOrDefault(space.getId(), NotificationLevel.ALL)))
      .toList();
  }

  @Transactional
  public NotificationSettingResponse change(Long memberId, Long spaceId, NotificationLevel level) {
    spaceRepository.findById(spaceId)
      .filter(space -> !space.isDeleted())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    settingRepository.upsert(memberId, spaceId, level.name());
    return new NotificationSettingResponse(spaceId, level);
  }
}
