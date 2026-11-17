package dev.jkchappy.portal.notification;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class DocumentReadRepositoryTest {

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private DocumentReadRepository documentReadRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private MemberRepository memberRepository;

  @Autowired
  private NotificationSettingRepository notificationSettingRepository;

  @Autowired
  private DocumentMentionRepository documentMentionRepository;

  private Long me;
  private Long other;
  private Long spaceId;
  private final Instant since = Instant.now().minus(14, ChronoUnit.DAYS);

  @BeforeEach
  void setUp() {
    me = memberRepository.save(Member.create("나")).getId();
    other = memberRepository.save(Member.create("동료")).getId();
    spaceId = spaceRepository.save(Space.create("개발", null, other)).getId();
  }

  private Document saveEdited(String title, Long updatedBy, Instant updatedAt) {
    Document doc = Document.create(spaceId, title, updatedBy);
    ReflectionTestUtils.setField(doc, "updatedAt", updatedAt);
    return documentRepository.saveAndFlush(doc);
  }

  private List<String> unreadTitles() {
    return documentRepository.findUnreadUpdates(me, since, 30).stream().map(Document::getTitle).toList();
  }

  @Test
  void findUnreadUpdates_othersRecentEditsNotYetRead_newestFirst() {
    Instant now = Instant.now();
    saveEdited("오래된 수정", other, now.minus(20, ChronoUnit.DAYS));
    saveEdited("내 수정", me, now);
    saveEdited("어제 수정", other, now.minus(1, ChronoUnit.DAYS));
    saveEdited("방금 수정", other, now);
    Document deleted = saveEdited("삭제된 페이지", other, now);
    deleted.softDelete();
    documentRepository.saveAndFlush(deleted);

    assertThat(unreadTitles()).containsExactly("방금 수정", "어제 수정");
  }

  @Test
  void findUnreadUpdates_readAfterEdit_hidden_editedAgain_shown() {
    Instant edited = Instant.now().minus(1, ChronoUnit.HOURS);
    Document doc = saveEdited("회의록", other, edited);

    documentReadRepository.upsert(me, doc.getId(), edited.plusSeconds(60));
    assertThat(unreadTitles()).isEmpty();

    // 확인 뒤 다시 수정되면 다시 알림, 확인 시각은 같은 행을 덮어씀
    ReflectionTestUtils.setField(doc, "updatedAt", edited.plusSeconds(120));
    documentRepository.saveAndFlush(doc);
    assertThat(unreadTitles()).containsExactly("회의록");

    documentReadRepository.upsert(me, doc.getId(), edited.plusSeconds(180));
    assertThat(unreadTitles()).isEmpty();
    assertThat(documentReadRepository.count()).isEqualTo(1);
  }

  @Test
  void findUnreadUpdates_offProject_hidesEverything() {
    Document doc = saveEdited("회의록", other, Instant.now());
    documentMentionRepository.insert(doc.getId(), me, other, Instant.now());

    notificationSettingRepository.upsert(me, spaceId, "OFF");

    assertThat(unreadTitles()).isEmpty();
  }

  @Test
  void findUnreadUpdates_mentionProject_showsOnlyUnreadMentionsByOthers() {
    Instant now = Instant.now();
    saveEdited("그냥 수정", other, now);
    Document mentioned = saveEdited("언급된 페이지", other, now.minusSeconds(60));
    documentMentionRepository.insert(mentioned.getId(), me, other, now.minusSeconds(60));
    Document selfMention = saveEdited("내가 나를 언급", me, now);
    documentMentionRepository.insert(selfMention.getId(), me, me, now);
    notificationSettingRepository.upsert(me, spaceId, "MENTION");

    assertThat(unreadTitles()).containsExactly("언급된 페이지");
    assertThat(documentMentionRepository.findUnreadMentionedDocumentIds(me,
      List.of(mentioned.getId(), selfMention.getId()))).containsExactly(mentioned.getId());

    // 언급 뒤에 확인하면 사라지고, 확인 뒤 다른 사람이 수정만 하면 다시 뜨지 않음
    documentReadRepository.upsert(me, mentioned.getId(), now);
    ReflectionTestUtils.setField(mentioned, "updatedAt", now.plusSeconds(60));
    documentRepository.saveAndFlush(mentioned);
    assertThat(unreadTitles()).isEmpty();
  }

  @Test
  void findUnreadUpdates_allProject_mentionByOtherOnMyEdit_shown() {
    // 마지막 수정자가 나여도 다른 사람이 나를 언급했으면 알림
    Document doc = saveEdited("내가 고친 페이지", me, Instant.now());
    documentMentionRepository.insert(doc.getId(), me, other, Instant.now().minusSeconds(30));

    assertThat(unreadTitles()).containsExactly("내가 고친 페이지");
  }

  @Test
  void notificationSetting_upsertOverwrites() {
    notificationSettingRepository.upsert(me, spaceId, "OFF");
    notificationSettingRepository.upsert(me, spaceId, "MENTION");

    assertThat(notificationSettingRepository.findByMemberId(me)).singleElement()
      .extracting(NotificationSetting::getLevel).isEqualTo(NotificationLevel.MENTION);
  }
}
