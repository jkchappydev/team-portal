package dev.jkchappy.portal.document;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

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
}
