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
}
