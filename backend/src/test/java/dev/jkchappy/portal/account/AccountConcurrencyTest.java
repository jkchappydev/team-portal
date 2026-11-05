package dev.jkchappy.portal.account;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfig.class)
class AccountConcurrencyTest {
  @Autowired AccountService service;
  @Autowired AccountRepository accounts;
  @Autowired MemberRepository members;

  @Test
  void concurrentApprovalsOfSameRequestAllowOnlyOne() throws Exception {
    String suffix = UUID.randomUUID().toString();
    Member admin = members.save(Member.create("관리자"));
    Member first = members.save(Member.create("첫째"));
    Member second = members.save(Member.create("둘째"));
    Account account = accounts.save(Account.createPending(suffix, suffix + "@example.com", "사용자", Instant.now()));
    var results = runConcurrently(
      () -> approve(account.getId(), first.getId(), admin.getId()),
      () -> approve(account.getId(), second.getId(), admin.getId()));
    assertThat(results).containsExactlyInAnyOrder("OK", ErrorCode.REQUEST_ALREADY_DECIDED.name());
    assertThat(accounts.findById(account.getId()).orElseThrow().getStatus()).isEqualTo(AccountStatus.APPROVED);
  }

  @Test
  void concurrentApprovalsCannotLinkSameMemberTwice() throws Exception {
    String suffix = UUID.randomUUID().toString();
    Member member = members.save(Member.create("팀원"));
    Account first = accounts.save(Account.createPending("a" + suffix, "a" + suffix + "@example.com", "첫째", Instant.now()));
    Account second = accounts.save(Account.createPending("b" + suffix, "b" + suffix + "@example.com", "둘째", Instant.now()));
    var results = runConcurrently(
      () -> approve(first.getId(), member.getId(), member.getId()),
      () -> approve(second.getId(), member.getId(), member.getId()));
    assertThat(results).containsExactlyInAnyOrder("OK", ErrorCode.MEMBER_ALREADY_LINKED.name());
  }

  private String approve(Long accountId, Long memberId, Long adminId) {
    try { service.approveWithMember(accountId, memberId, adminId); return "OK"; }
    catch (BusinessException e) { return e.getErrorCode().name(); }
  }

  private List<String> runConcurrently(Callable<String> first, Callable<String> second) throws Exception {
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var a = executor.submit(() -> { start.await(); return first.call(); });
      var b = executor.submit(() -> { start.await(); return second.call(); });
      start.countDown();
      return List.of(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
    }
  }
}
