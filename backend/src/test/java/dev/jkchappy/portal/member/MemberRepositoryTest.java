package dev.jkchappy.portal.member;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
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
}
