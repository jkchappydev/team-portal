package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class WorkStatusRepositoryTest {

  @Autowired
  private WorkStatusRepository workStatusRepository;

  @Autowired
  private MemberRepository memberRepository;

  private int count(String ym) {
    YearMonth month = YearMonth.parse(ym);
    return workStatusRepository.findOverlapping(month.atDay(1), month.atEndOfMonth()).size();
  }

  @Test
  void findByMonth_includesEntriesOverlappingMonthBoundary() {
    Member member = memberRepository.save(Member.create("홍길동"));
    workStatusRepository.save(WorkStatus.create(member.getId(), WorkStatusType.LEAVE,
      LocalDate.of(2026, 10, 30), LocalDate.of(2026, 11, 3), null, null, null, null, null,
      member.getId()));

    assertThat(count("2026-10")).isEqualTo(1);
    assertThat(count("2026-11")).isEqualTo(1);
    assertThat(count("2026-12")).isEqualTo(0);
  }

  @Test
  void findLeaveOverlapping_excludesNonLeaveTypes() {
    Member member = memberRepository.save(Member.create("홍길동"));
    workStatusRepository.save(WorkStatus.create(member.getId(), WorkStatusType.LEAVE,
      LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 2), null, null, null, null, null,
      member.getId()));
    workStatusRepository.save(WorkStatus.create(member.getId(), WorkStatusType.BUSINESS_TRIP,
      LocalDate.of(2026, 11, 3), LocalDate.of(2026, 11, 3), null, null, null, "서울", null,
      member.getId()));

    assertThat(workStatusRepository.findLeaveOverlapping(LocalDate.of(2026, 1, 1),
      LocalDate.of(2026, 12, 31))).extracting(WorkStatus::getType)
      .containsExactly(WorkStatusType.LEAVE);
  }
}
