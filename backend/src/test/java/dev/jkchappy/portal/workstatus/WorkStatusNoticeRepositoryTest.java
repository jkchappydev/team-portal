package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.member.JobRank;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Limit;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class WorkStatusNoticeRepositoryTest {

  private static final Instant NOW = Instant.parse("2026-11-13T01:00:00Z");

  @Autowired
  private WorkStatusNoticeRepository noticeRepository;

  @Autowired
  private MemberRepository memberRepository;

  @Autowired
  private EntityManager entityManager;

  private Member member(String name, JobRank rank) {
    Member member = Member.create(name);
    member.setOrganization("부서", rank);
    return memberRepository.save(member);
  }

  private WorkStatusNotice notice(Member recipient, Member actor, Instant at) {
    return noticeRepository.save(WorkStatusNotice.of(recipient.getId(), new WorkStatusChangedEvent(
      WorkStatusAction.CREATED, actor.getId(), "홍길동 연차", LocalDate.of(2026, 11, 20),
      LocalDate.of(2026, 11, 20)), at));
  }

  @Test
  void recipients_areTeamLeadOrAboveAndDevelopers() {
    Member head = member("본부장", JobRank.HEAD);
    Member lead = member("팀장", JobRank.TEAM_LEAD);
    member("책임", JobRank.RESPONSIBLE);
    Member developer = member("개발자", JobRank.SENIOR);
    developer.grantDeveloper();
    Member inactive = member("비활성팀장", JobRank.TEAM_LEAD);
    inactive.deactivate();
    Member deleted = member("삭제팀장", JobRank.TEAM_LEAD);
    deleted.markDeleted(LocalDate.of(2026, 11, 1));
    entityManager.flush();

    assertThat(memberRepository.findWorkStatusNoticeRecipients(WorkStatusNoticeService.NOTICE_RANKS))
      .extracting(Member::getId)
      .containsExactlyInAnyOrder(head.getId(), lead.getId(), developer.getId());
  }

  @Test
  void unread_excludesReadOldAndOthers_andReadAllMarksOnlyMine() {
    Member me = member("팀장", JobRank.TEAM_LEAD);
    Member other = member("본부장", JobRank.HEAD);
    Member actor = member("팀원", JobRank.SENIOR);
    WorkStatusNotice older = notice(me, actor, NOW.minusSeconds(60));
    WorkStatusNotice newer = notice(me, actor, NOW);
    notice(me, actor, NOW.minusSeconds(20 * 86_400));
    notice(me, actor, NOW).markRead(NOW);
    WorkStatusNotice othersNotice = notice(other, actor, NOW);
    entityManager.flush();

    Instant since = NOW.minus(WorkStatusNoticeService.LOOKBACK);
    assertThat(noticeRepository.findByRecipientIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDescIdDesc(
      me.getId(), since, Limit.of(30))).extracting(WorkStatusNotice::getId)
      .containsExactly(newer.getId(), older.getId());

    noticeRepository.markAllRead(me.getId(), NOW);
    entityManager.clear();

    assertThat(noticeRepository.findByRecipientIdAndReadAtIsNullAndCreatedAtAfterOrderByCreatedAtDescIdDesc(
      me.getId(), since, Limit.of(30))).isEmpty();
    assertThat(noticeRepository.findById(othersNotice.getId()).orElseThrow().getReadAt()).isNull();
    assertThat(noticeRepository.findByIdAndRecipientId(othersNotice.getId(), me.getId())).isEmpty();
  }
}
