package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.JobRank;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.workstatus.dto.WorkStatusNoticeList;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WorkStatusNoticeServiceTest {

  private static final Instant NOW = Instant.parse("2026-11-13T01:00:00Z");

  private static final WorkStatusChangedEvent EVENT = new WorkStatusChangedEvent(WorkStatusAction.CREATED, 2L,
    "홍길동 연차", LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 20));

  @Mock
  private WorkStatusNoticeRepository noticeRepository;

  @Mock
  private MemberRepository memberRepository;

  @Mock
  private MemberService memberService;

  private WorkStatusNoticeService service() {
    return new WorkStatusNoticeService(noticeRepository, memberRepository, memberService,
      Clock.fixed(NOW, ZoneOffset.UTC));
  }

  private static Member member(long id, JobRank rank) {
    Member member = Member.create("팀원" + id);
    member.setOrganization("부서", rank);
    ReflectionTestUtils.setField(member, "id", id);
    return member;
  }

  @Test
  @SuppressWarnings("unchecked")
  void onChanged_savesNoticeForEachRecipientExceptActor() {
    when(memberRepository.findWorkStatusNoticeRecipients())
      .thenReturn(List.of(member(1, JobRank.TEAM_LEAD), member(2, JobRank.HEAD), member(3, JobRank.SENIOR)));

    service().onChanged(EVENT);

    ArgumentCaptor<List<WorkStatusNotice>> saved = ArgumentCaptor.forClass(List.class);
    verify(noticeRepository).saveAll(saved.capture());
    assertThat(saved.getValue()).extracting(WorkStatusNotice::getRecipientId).containsExactly(1L, 3L);
    assertThat(saved.getValue().get(0).getLabel()).isEqualTo("홍길동 연차");
    assertThat(saved.getValue().get(0).getCreatedAt()).isEqualTo(NOW);
  }

  @Test
  // 팀장 직책이어도 관리자·개발자 권한이 없으면 알림 대상이 아님
  void findUnread_notRecipient_returnsDisabled() {
    when(memberRepository.findById(5L)).thenReturn(Optional.of(member(5, JobRank.TEAM_LEAD)));

    WorkStatusNoticeList result = service().findUnread(5L);

    assertThat(result.enabled()).isFalse();
    assertThat(result.items()).isEmpty();
  }

  @Test
  void findUnread_developer_returnsItemsWithActorName() {
    Member developer = member(5, JobRank.SENIOR);
    developer.grantDeveloper();
    when(memberRepository.findById(5L)).thenReturn(Optional.of(developer));
    when(noticeRepository.findByRecipientIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDescIdDesc(
      any(), any(), any())).thenReturn(List.of(WorkStatusNotice.of(5L, EVENT, NOW)));
    when(memberService.findNamesByIds(anyList())).thenReturn(Map.of(2L, "김팀원"));

    WorkStatusNoticeList result = service().findUnread(5L);

    assertThat(result.enabled()).isTrue();
    assertThat(result.items()).singleElement().satisfies(item -> {
      assertThat(item.actorName()).isEqualTo("김팀원");
      assertThat(item.action()).isEqualTo(WorkStatusAction.CREATED);
    });
  }

  @Test
  void markRead_othersNotice_throwsNotFound() {
    when(noticeRepository.findByIdAndRecipientId(9L, 1L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().markRead(1L, 9L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }
}
