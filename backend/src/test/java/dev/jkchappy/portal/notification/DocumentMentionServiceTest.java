package dev.jkchappy.portal.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.member.MemberService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DocumentMentionServiceTest {

  private static final Instant NOW = Instant.parse("2026-11-17T01:00:00Z");

  @Mock
  private DocumentMentionRepository mentionRepository;

  @Mock
  private MemberService memberService;

  private DocumentMentionService service;

  @BeforeEach
  void setUp() {
    service = new DocumentMentionService(mentionRepository, memberService, Clock.fixed(NOW, ZoneOffset.UTC));
    // 1~9번만 있는 팀원
    org.mockito.Mockito.lenient().when(memberService.findNamesByIds(any())).thenAnswer(invocation -> {
      Map<Long, String> names = new HashMap<>();
      for (Long id : invocation.<Collection<Long>>getArgument(0)) {
        if (id < 10) {
          names.put(id, "팀원" + id);
        }
      }
      return names;
    });
  }

  @Test
  void sync_addsNewMentions_removesMissing_keepsExisting() {
    when(mentionRepository.findMemberIds(1L)).thenReturn(List.of(3L, 4L));

    service.sync(1L, List.of(4L, 5L, 99L), 2L);

    // 4는 그대로(처음 언급 시각 유지), 5만 새로, 없는 팀원 99는 무시, 빠진 3은 삭제
    verify(mentionRepository).insert(1L, 5L, 2L, NOW);
    verify(mentionRepository, never()).insert(eq(1L), eq(4L), any(), any());
    verify(mentionRepository, never()).insert(eq(1L), eq(99L), any(), any());
    verify(mentionRepository).delete(1L, Set.of(3L));
  }

  @Test
  void sync_unknownEditor_recordsWithoutMentioner() {
    when(mentionRepository.findMemberIds(1L)).thenReturn(List.of());

    service.sync(1L, List.of(5L), 99L);

    verify(mentionRepository).insert(1L, 5L, null, NOW);
  }

  @Test
  void sync_emptyList_removesAll() {
    when(mentionRepository.findMemberIds(1L)).thenReturn(List.of(3L));

    service.sync(1L, List.of(), 2L);

    verify(mentionRepository).delete(1L, Set.of(3L));
    verify(mentionRepository, never()).insert(anyLong(), anyLong(), any(), any());
  }

  @Test
  void sync_nullList_keepsMentions() {
    service.sync(1L, null, 2L);

    verifyNoInteractions(mentionRepository);
  }
}
