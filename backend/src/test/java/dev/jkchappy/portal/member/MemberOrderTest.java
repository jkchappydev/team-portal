package dev.jkchappy.portal.member;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class MemberOrderTest {
  private Member member(long id, String name, JobRank rank) {
    Member member = Member.create(name);
    ReflectionTestUtils.setField(member, "id", id);
    member.setOrganization("개발", rank);
    return member;
  }

  @Test
  void defaultOrderUsesRankThenName() {
    Member senior = member(1, "가", JobRank.SENIOR);
    Member lead = member(2, "나", JobRank.TEAM_LEAD);
    Member head = member(3, "다", JobRank.HEAD);
    Member otherLead = member(4, "가", JobRank.TEAM_LEAD);
    assertThat(MemberOrder.sorted(List.of(senior, lead, head, otherLead)))
      .extracting(Member::getId).containsExactly(3L, 4L, 2L, 1L);
  }

  @Test
  void explicitOrderOverridesRankAndNewMembersAreLast() {
    Member head = member(1, "가", JobRank.HEAD);
    Member senior = member(2, "나", JobRank.SENIOR);
    Member newMember = member(3, "다", JobRank.HEAD);
    head.changeSortOrder(1L);
    senior.changeSortOrder(0L);
    assertThat(MemberOrder.sorted(List.of(head, newMember, senior)))
      .extracting(Member::getId).containsExactly(2L, 1L, 3L);
    MemberOrder.placeNew(newMember, List.of(head, senior));
    assertThat(newMember.getSortOrder()).isEqualTo(2L);
  }
}
