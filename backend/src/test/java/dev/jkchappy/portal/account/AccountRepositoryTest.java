package dev.jkchappy.portal.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class AccountRepositoryTest {
  @Autowired private AccountRepository accounts;
  @Autowired private MemberRepository members;

  @Test
  void findByGoogleSubjectReturnsSaved() {
    accounts.save(Account.createPending("subject", "one@example.com", "이름", Instant.now()));
    assertThat(accounts.findByGoogleSubject("subject")).get().satisfies(account -> {
      assertThat(account.getEmail()).isEqualTo("one@example.com");
      assertThat(account.getStatus()).isEqualTo(AccountStatus.PENDING);
    });
  }

  @Test
  void memberIdIsUnique() {
    Member member = members.saveAndFlush(Member.create("팀원"));
    Account first = Account.createPending("one", "one@example.com", "하나", Instant.now());
    first.approve(member, member.getId(), Instant.now());
    accounts.saveAndFlush(first);
    Account second = Account.createPending("two", "two@example.com", "둘", Instant.now());
    second.approve(member, member.getId(), Instant.now());
    assertThatThrownBy(() -> accounts.saveAndFlush(second)).isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void findByStatusInOrdersByRequestedAt() {
    Instant now = Instant.now();
    accounts.save(Account.createPending("later", "later@example.com", "나중", now));
    accounts.save(Account.createPending("earlier", "earlier@example.com", "먼저", now.minusSeconds(1)));
    Member member = members.save(Member.create("팀원"));
    Account approved = Account.createPending("approved", "approved@example.com", "승인", now);
    approved.approve(member, member.getId(), now);
    accounts.save(approved);
    assertThat(accounts.findByStatusInOrderByRequestedAtAsc(List.of(AccountStatus.PENDING, AccountStatus.REJECTED)))
      .extracting(Account::getGoogleSubject).containsExactly("earlier", "later");
  }
}
