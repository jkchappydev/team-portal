package dev.jkchappy.portal.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.account.AccountRepository;
import dev.jkchappy.portal.member.dto.MemberCreateRequest;
import dev.jkchappy.portal.member.dto.MemberResponse;
import dev.jkchappy.portal.member.dto.MemberUpdateRequest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class MemberServiceTest {

  @Mock
  private MemberRepository memberRepository;

  @Mock
  private AccountRepository accountRepository;

  @InjectMocks
  private MemberService memberService;

  @Test
  void create_trimsName() {
    when(memberRepository.save(any(Member.class))).thenAnswer(inv -> inv.getArgument(0));

    MemberResponse response = memberService.create(new MemberCreateRequest(" 홍길동 "));

    assertThat(response.name()).isEqualTo("홍길동");
    assertThat(response.active()).isTrue();
  }

  @Test
  void getActiveMember_inactive_throwsUserNotSelected() {
    Member inactive = Member.create("비활성");
    inactive.deactivate();
    when(memberRepository.findById(1L)).thenReturn(Optional.of(inactive));

    assertThatThrownBy(() -> memberService.getActiveMember(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.MEMBER_INACTIVE));
  }

  @Test
  void getActiveMember_missing_throwsUserNotSelected() {
    when(memberRepository.findById(9L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> memberService.getActiveMember(9L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.MEMBER_INACTIVE));
  }

  @Test
  void update_unknownId_throwsNotFound() {
    when(memberRepository.findById(9L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> memberService.update(9L, new MemberUpdateRequest("x", null)))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void update_deactivatesAndRenames() {
    Member member = Member.create("원래");
    when(memberRepository.findById(1L)).thenReturn(Optional.of(member));

    MemberResponse response = memberService.update(1L, new MemberUpdateRequest(" 새이름 ", false));

    assertThat(response.name()).isEqualTo("새이름");
    assertThat(response.active()).isFalse();
  }

  @Test
  void update_cannotAssignDeveloperRank() {
    Member member = Member.create("홍길동");
    member.setOrganization("개발부", JobRank.SENIOR);
    when(memberRepository.findById(1L)).thenReturn(Optional.of(member));

    assertThatThrownBy(() -> memberService.update(1L,
      new MemberUpdateRequest(null, null, null, JobRank.DEVELOPER)))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    assertThat(member.getJobRank()).isEqualTo(JobRank.SENIOR);
  }

  @Test
  void update_developerRank_cannotBeChangedButCanBeKept() {
    Member developer = Member.create("홍길동");
    developer.setOrganization("개발부", JobRank.DEVELOPER);
    when(memberRepository.findById(1L)).thenReturn(Optional.of(developer));

    assertThatThrownBy(() -> memberService.update(1L,
      new MemberUpdateRequest(null, null, null, JobRank.HEAD)))
      .isInstanceOf(BusinessException.class);

    // 본인 정보 저장 시 같은 직급을 그대로 보내는 것은 허용
    MemberResponse kept = memberService.update(1L,
      new MemberUpdateRequest(null, null, "콘텐츠개발부", JobRank.DEVELOPER));
    assertThat(kept.jobRank()).isEqualTo(JobRank.DEVELOPER);
  }

  @Test
  void updateCannotDeactivateLastActiveAdmin() {
    Member admin = Member.create("관리자");
    admin.grantAdmin();
    when(memberRepository.findById(1L)).thenReturn(Optional.of(admin));
    when(memberRepository.lockActiveAdmins()).thenReturn(List.of(admin));
    assertThatThrownBy(() -> memberService.update(1L, new MemberUpdateRequest(null, false)))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LAST_ADMIN));
    assertThat(admin.isActive()).isTrue();
  }

  @Test
  void movePersistsSharedOrder() {
    Member first = Member.create("가");
    Member second = Member.create("나");
    ReflectionTestUtils.setField(first, "id", 1L);
    ReflectionTestUtils.setField(second, "id", 2L);
    when(memberRepository.lockAllForOrder()).thenReturn(List.of(first, second));
    memberService.move(2L, 1L);
    assertThat(first.getSortOrder()).isEqualTo(1L);
    assertThat(second.getSortOrder()).isZero();
  }

  @Test
  void update_blankName_throwsInvalidInput() {
    when(memberRepository.findById(1L)).thenReturn(Optional.of(Member.create("원래")));

    assertThatThrownBy(() -> memberService.update(1L, new MemberUpdateRequest("   ", null)))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void findAll_excludesInactiveWhenFlagFalse() {
    when(memberRepository.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(Member.create("가")));

    assertThat(memberService.findAll(false)).extracting(MemberResponse::name).containsExactly("가");
  }

  @Test
  void findNamesByIds_emptyInput_returnsEmptyMap() {
    assertThat(memberService.findNamesByIds(List.of())).isEmpty();
  }

  @Test
  void findNamesByIds_returnsIdToName() {
    Member m = Member.create("가");
    when(memberRepository.findAllById(List.of(1L))).thenReturn(List.of(m));

    Map<Long, String> names = memberService.findNamesByIds(List.of(1L));

    assertThat(names).containsValue("가");
  }

  // 한국 시간 2027-01-01 00:30 (UTC로는 2026-12-31)
  private MemberService serviceAt(String instant) {
    return new MemberService(memberRepository, accountRepository,
      Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
  }

  private Member saved(long id, String name) {
    Member member = Member.create(name);
    ReflectionTestUtils.setField(member, "id", id);
    return member;
  }

  @Test
  void delete_marksDeletedWithKoreanDate_andBlocksLogin() {
    Member admin = saved(1L, "관리자");
    admin.grantAdmin();
    Member target = saved(2L, "퇴사자");
    target.grantAdmin();
    when(memberRepository.lockActiveAdmins()).thenReturn(List.of(admin, target));
    when(memberRepository.findForUpdateById(2L)).thenReturn(Optional.of(target));

    serviceAt("2026-12-31T15:30:00Z").delete(2L, 1L);

    assertThat(target.getDeletedOn()).isEqualTo(LocalDate.of(2027, 1, 1));
    assertThat(target.isActive()).isFalse();
    assertThat(target.isAdmin()).isFalse();
  }

  @Test
  void delete_self_throwsInvalidInput() {
    assertThatThrownBy(() -> serviceAt("2026-11-05T00:00:00Z").delete(1L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void delete_lastActiveAdmin_throwsLastAdmin() {
    Member lastAdmin = saved(2L, "관리자");
    lastAdmin.grantAdmin();
    when(memberRepository.lockActiveAdmins()).thenReturn(List.of(lastAdmin));
    when(memberRepository.findForUpdateById(2L)).thenReturn(Optional.of(lastAdmin));

    assertThatThrownBy(() -> serviceAt("2026-11-05T00:00:00Z").delete(2L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LAST_ADMIN));
    assertThat(lastAdmin.isDeleted()).isFalse();
  }

  @Test
  void delete_alreadyDeleted_throwsNotFound() {
    Member deleted = saved(2L, "퇴사자");
    deleted.markDeleted(LocalDate.of(2026, 1, 1));
    when(memberRepository.findForUpdateById(2L)).thenReturn(Optional.of(deleted));

    assertThatThrownBy(() -> serviceAt("2026-11-05T00:00:00Z").delete(2L, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void update_deletedMember_throwsNotFound() {
    Member deleted = saved(2L, "퇴사자");
    deleted.markDeleted(LocalDate.of(2026, 1, 1));
    when(memberRepository.findById(2L)).thenReturn(Optional.of(deleted));

    assertThatThrownBy(() -> memberService.update(2L, new MemberUpdateRequest(null, true, null, null)))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  @Test
  void findAll_includeInactive_excludesDeleted() {
    when(memberRepository.findByDeletedOnIsNullOrderByNameAsc()).thenReturn(List.of(saved(1L, "남은 팀원")));

    assertThat(memberService.findAll(true)).extracting(MemberResponse::name).containsExactly("남은 팀원");
  }

  @Test
  void findNamesByIds_keepsDeletedMemberName() {
    Member deleted = saved(2L, "퇴사자");
    deleted.markDeleted(LocalDate.of(2026, 1, 1));
    when(memberRepository.findAllById(List.of(2L))).thenReturn(List.of(deleted));

    assertThat(memberService.findNamesByIds(List.of(2L))).containsEntry(2L, "퇴사자");
  }

  @Test
  void update_phone_savesTrimmedAndClearsWhenEmpty() {
    Member member = saved(3L, "팀원");
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    MemberResponse saved = memberService.update(3L, new MemberUpdateRequest(null, null, null, null, " 010-1234-5678 "));
    assertThat(saved.phone()).isEqualTo("010-1234-5678");

    memberService.update(3L, new MemberUpdateRequest(null, null, null, null, ""));
    assertThat(member.getPhone()).isNull();
  }

  @Test
  void update_phone_withLetters_throwsInvalidInput() {
    when(memberRepository.findById(3L)).thenReturn(Optional.of(saved(3L, "팀원")));

    assertThatThrownBy(() -> memberService.update(3L, new MemberUpdateRequest(null, null, null, null, "010-abcd-5678")))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void update_extension_savesTrimmedAndClearsWhenEmpty() {
    Member member = saved(3L, "팀원");
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    MemberResponse saved = memberService.update(3L, new MemberUpdateRequest(null, null, null, null, null, " 1234 "));
    assertThat(saved.extension()).isEqualTo("1234");

    memberService.update(3L, new MemberUpdateRequest(null, null, null, null, null, ""));
    assertThat(member.getExtension()).isNull();
  }

  @Test
  void update_extension_withNonDigits_throwsInvalidInput() {
    when(memberRepository.findById(3L)).thenReturn(Optional.of(saved(3L, "팀원")));

    assertThatThrownBy(() -> memberService.update(3L, new MemberUpdateRequest(null, null, null, null, null, "12-34")))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    assertThatThrownBy(() -> memberService.update(3L, new MemberUpdateRequest(null, null, null, null, null, "1")))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void update_withoutExtension_keepsExistingExtension() {
    Member member = saved(3L, "팀원");
    member.changeExtension("1234");
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    memberService.update(3L, new MemberUpdateRequest(null, null, null, null, "010-1111-2222"));

    assertThat(member.getExtension()).isEqualTo("1234");
  }

  @Test
  void update_withoutPhone_keepsExistingPhone() {
    Member member = saved(3L, "팀원");
    member.changePhone("010-1111-2222");
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    memberService.update(3L, new MemberUpdateRequest("새이름", null));

    assertThat(member.getPhone()).isEqualTo("010-1111-2222");
  }
}
