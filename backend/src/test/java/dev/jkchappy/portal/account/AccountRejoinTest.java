package dev.jkchappy.portal.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.account.dto.GoogleProfile;
import dev.jkchappy.portal.account.dto.SignupRequestResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.JobRank;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.member.MemberService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// 실제 DB로 삭제 → 재가입 요청 → 재승인 시 이전 팀원 기록에 다시 연결되는지 확인
@SpringBootTest
@Import(TestcontainersConfig.class)
class AccountRejoinTest {
  @Autowired AccountService service;
  @Autowired MemberService memberService;
  @Autowired AccountRepository accounts;
  @Autowired MemberRepository members;

  @Test
  void deletedMember_loginAgain_becomesRequest_andApprovalReconnectsPreviousMember() {
    String suffix = UUID.randomUUID().toString();
    Member admin = Member.create("관리자");
    admin.grantAdmin();
    admin = members.save(admin);
    Member target = members.save(Member.create("이재구"));
    Account account = accounts.save(Account.createPending(suffix, suffix + "@example.com", "이재구", Instant.now()));
    service.approveWithMember(account.getId(), target.getId(), admin.getId(), "개발팀", JobRank.SENIOR);

    // 퇴사 처리 후 같은 구글 계정으로 다시 로그인
    memberService.delete(target.getId(), admin.getId());
    service.registerLogin(new GoogleProfile(suffix, suffix + "@example.com", "이재구"));

    assertThatThrownBy(() -> service.requireActiveMemberId(suffix))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ACCOUNT_PENDING));
    SignupRequestResponse request = service.listRequests().stream()
      .filter(r -> r.id().equals(account.getId())).findFirst().orElseThrow();
    assertThat(request.previousMemberId()).isEqualTo(target.getId());
    assertThat(request.previousMemberName()).isEqualTo("이재구");
    assertThat(request.previousDepartment()).isEqualTo("개발팀");

    // 관리자가 이전 기록과 다시 연결해 승인
    service.approveWithMember(account.getId(), target.getId(), admin.getId(), "개발팀", JobRank.SENIOR);

    assertThat(service.requireActiveMemberId(suffix)).isEqualTo(target.getId());
    Member restored = members.findById(target.getId()).orElseThrow();
    assertThat(restored.isDeleted()).isFalse();
    assertThat(restored.isActive()).isTrue();
  }

  @Test
  void deletedMemberOfAnotherAccount_cannotBeLinked() {
    String suffix = UUID.randomUUID().toString();
    Member admin = Member.create("관리자");
    admin.grantAdmin();
    admin = members.save(admin);
    Member left = members.save(Member.create("퇴사자"));
    memberService.delete(left.getId(), admin.getId());
    Account stranger = accounts.save(Account.createPending(suffix, suffix + "@example.com", "다른 사람", Instant.now()));
    Long adminId = admin.getId();

    assertThatThrownBy(() -> service.approveWithMember(stranger.getId(), left.getId(), adminId, "개발팀", JobRank.SENIOR))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }
}
