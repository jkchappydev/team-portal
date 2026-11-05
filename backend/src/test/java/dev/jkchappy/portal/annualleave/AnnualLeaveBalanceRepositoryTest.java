package dev.jkchappy.portal.annualleave;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class AnnualLeaveBalanceRepositoryTest {

  @Autowired
  private AnnualLeaveBalanceRepository balanceRepository;

  @Autowired
  private MemberRepository memberRepository;

  @Test
  void findByMemberAndYear_returnsSavedBalance() {
    Member member = memberRepository.save(Member.create("홍길동"));
    balanceRepository.save(AnnualLeaveBalance.create(member.getId(), 2026,
      new BigDecimal("15"), new BigDecimal("1.5")));

    AnnualLeaveBalance result = balanceRepository.findByMemberIdAndYear(member.getId(), 2026)
      .orElseThrow();

    assertThat(result.getConfirmedDays()).isEqualByComparingTo("15");
    assertThat(result.getCarriedDays()).isEqualByComparingTo("1.5");
  }
}
