package dev.jkchappy.portal.member;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class MemberRepositoryTest {

  @Autowired
  private MemberRepository memberRepository;

  @Test
  void countByAdminTrueAndActiveTrue() {
    Member activeAdmin = Member.create("활성 관리자");
    activeAdmin.grantAdmin();
    memberRepository.save(activeAdmin);
    Member inactiveAdmin = Member.create("비활성 관리자");
    inactiveAdmin.grantAdmin();
    inactiveAdmin.deactivate();
    memberRepository.save(inactiveAdmin);
    memberRepository.save(Member.create("일반 팀원"));
    assertThat(memberRepository.countByAdminTrueAndActiveTrue()).isEqualTo(1);
  }

  @Test
  void findAll_excludesInactiveByDefault() {
    memberRepository.save(Member.create("김철수"));
    Member inactive = Member.create("이영희");
    inactive.deactivate();
    memberRepository.save(inactive);

    List<Member> result = memberRepository.findByActiveTrueOrderByNameAsc();

    assertThat(result).extracting(Member::getName).containsExactly("김철수");
  }

  @Test
  void findAllByOrderByNameAsc_includesInactive() {
    memberRepository.save(Member.create("나나"));
    Member inactive = Member.create("가가");
    inactive.deactivate();
    memberRepository.save(inactive);

    assertThat(memberRepository.findAllByOrderByNameAsc())
      .extracting(Member::getName).containsExactly("가가", "나나");
  }

  @Test
  void findVisibleInYear_showsDeletedMemberUntilDeletionYear() {
    memberRepository.save(Member.create("재직자"));
    Member inactive = Member.create("비활성");
    inactive.deactivate();
    memberRepository.save(inactive);
    Member left = Member.create("퇴사자");
    left.markDeleted(LocalDate.of(2026, 6, 30));
    memberRepository.save(left);

    assertThat(memberRepository.findVisibleInYear(LocalDate.of(2026, 1, 1)))
      .extracting(Member::getName).containsExactlyInAnyOrder("재직자", "비활성", "퇴사자");
    assertThat(memberRepository.findVisibleInYear(LocalDate.of(2027, 1, 1)))
      .extracting(Member::getName).containsExactlyInAnyOrder("재직자", "비활성");
  }

  @Test
  void findByDeletedOnIsNull_excludesDeleted() {
    memberRepository.save(Member.create("재직자"));
    Member left = Member.create("퇴사자");
    left.markDeleted(LocalDate.of(2026, 6, 30));
    memberRepository.save(left);

    assertThat(memberRepository.findByDeletedOnIsNullOrderByNameAsc())
      .extracting(Member::getName).containsExactly("재직자");
  }
}
