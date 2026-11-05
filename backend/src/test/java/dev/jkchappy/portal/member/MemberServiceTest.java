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
}
