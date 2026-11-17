package dev.jkchappy.portal.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.notification.dto.NotificationSettingResponse;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class NotificationSettingServiceTest {

  @Mock
  private NotificationSettingRepository settingRepository;

  @Mock
  private SpaceRepository spaceRepository;

  @InjectMocks
  private NotificationSettingService service;

  private Space space(Long id) {
    Space space = Space.create("프로젝트" + id, null, 1L);
    ReflectionTestUtils.setField(space, "id", id);
    return space;
  }

  private NotificationSetting setting(Long spaceId, NotificationLevel level) {
    NotificationSetting setting = org.springframework.beans.BeanUtils.instantiateClass(NotificationSetting.class);
    ReflectionTestUtils.setField(setting, "memberId", 1L);
    ReflectionTestUtils.setField(setting, "spaceId", spaceId);
    ReflectionTestUtils.setField(setting, "level", level);
    return setting;
  }

  @Test
  void findMine_unsavedProjectsDefaultToAll_inSidebarOrder() {
    when(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc())
      .thenReturn(List.of(space(3L), space(1L), space(2L)));
    when(settingRepository.findByMemberId(1L)).thenReturn(List.of(
      setting(1L, NotificationLevel.OFF), setting(2L, NotificationLevel.MENTION)));

    List<NotificationSettingResponse> result = service.findMine(1L);

    assertThat(result).extracting(NotificationSettingResponse::spaceId, NotificationSettingResponse::level)
      .containsExactly(tuple(3L, NotificationLevel.ALL), tuple(1L, NotificationLevel.OFF),
        tuple(2L, NotificationLevel.MENTION));
  }

  @Test
  void change_savesLevel() {
    when(spaceRepository.findById(2L)).thenReturn(Optional.of(space(2L)));

    NotificationSettingResponse result = service.change(1L, 2L, NotificationLevel.MENTION);

    verify(settingRepository).upsert(1L, 2L, "MENTION");
    assertThat(result.level()).isEqualTo(NotificationLevel.MENTION);
  }

  @Test
  void change_deletedProject_throwsNotFound() {
    Space deleted = space(2L);
    deleted.softDelete();
    when(spaceRepository.findById(2L)).thenReturn(Optional.of(deleted));

    assertThatThrownBy(() -> service.change(1L, 2L, NotificationLevel.OFF)).isInstanceOf(BusinessException.class);
    verify(settingRepository, never()).upsert(anyLong(), anyLong(), any());
  }
}
