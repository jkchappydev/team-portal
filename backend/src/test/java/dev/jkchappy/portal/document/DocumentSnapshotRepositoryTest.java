package dev.jkchappy.portal.document;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.document.dto.SnapshotMeta;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class DocumentSnapshotRepositoryTest {

  @Autowired
  private DocumentSnapshotRepository snapshotRepository;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private MemberRepository memberRepository;

  @Test
  void findFirstByDocumentId_returnsLatestSnapshot() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Document doc = documentRepository.save(Document.create(space.getId(), "문서", 1L));
    Instant base = Instant.parse("2026-11-04T01:00:00Z");
    snapshotRepository.save(DocumentSnapshot.create(doc.getId(), new byte[] {1}, base));
    snapshotRepository.save(DocumentSnapshot.create(doc.getId(), new byte[] {2}, base.plusSeconds(700)));
    snapshotRepository.flush();

    var latest = snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(doc.getId());

    assertThat(latest).isPresent();
    assertThat(latest.get().getContentState()).containsExactly(2);
    assertThat(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(-1L)).isEmpty();
  }

  @Test
  void findMetaByDocumentId_newestFirst_withAuthorAndReason_limited() {
    Member member = memberRepository.save(Member.create("김팀원"));
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Document doc = documentRepository.save(Document.create(space.getId(), "문서", 1L));
    Document other = documentRepository.save(Document.create(space.getId(), "다른 문서", 1L));
    Instant base = Instant.parse("2026-11-04T01:00:00Z");
    snapshotRepository.save(DocumentSnapshot.create(doc.getId(), new byte[] {1}, base));
    snapshotRepository.save(DocumentSnapshot.create(doc.getId(), new byte[] {2}, base.plusSeconds(700),
      member.getId(), SnapshotReason.BEFORE_RESTORE));
    snapshotRepository.save(DocumentSnapshot.create(other.getId(), new byte[] {3}, base.plusSeconds(900)));
    snapshotRepository.flush();

    List<SnapshotMeta> metas = snapshotRepository.findMetaByDocumentId(doc.getId(), PageRequest.of(0, 10));

    assertThat(metas).extracting(SnapshotMeta::createdAt).containsExactly(base.plusSeconds(700), base);
    assertThat(metas.get(0).createdBy()).isEqualTo(member.getId());
    assertThat(metas.get(0).reason()).isEqualTo(SnapshotReason.BEFORE_RESTORE);
    assertThat(metas.get(1).createdBy()).isNull();
    assertThat(metas.get(1).reason()).isEqualTo(SnapshotReason.AUTO);
    assertThat(snapshotRepository.findMetaByDocumentId(doc.getId(), PageRequest.of(0, 1))).hasSize(1);
  }
}
