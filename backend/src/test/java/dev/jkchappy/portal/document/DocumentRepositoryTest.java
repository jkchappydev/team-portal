package dev.jkchappy.portal.document;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class DocumentRepositoryTest {

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private PlatformTransactionManager transactionManager;

  private Document save(Long spaceId, String title, String plainText) {
    Document doc = Document.create(spaceId, title, 1L);
    ReflectionTestUtils.setField(doc, "plainText", plainText);
    return documentRepository.saveAndFlush(doc);
  }

  @Test
  void search_matchesTitleAndPlainText_excludesDeleted() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    save(space.getId(), "배포 절차", "");
    save(space.getId(), "회의록", "오늘 배포 일정 논의");
    Document deleted = save(space.getId(), "배포 삭제본", "");
    deleted.softDelete();
    documentRepository.saveAndFlush(deleted);
    save(space.getId(), "무관한 문서", "내용 없음");

    List<Document> result = documentRepository.search("%배포%");

    assertThat(result).extracting(Document::getTitle)
      .containsExactlyInAnyOrder("배포 절차", "회의록");
  }

  @Test
  void search_excludesDocumentsInDeletedSpace() {
    Space space = spaceRepository.save(Space.create("보관", null, 1L));
    save(space.getId(), "배포 문서", "");
    space.softDelete();
    spaceRepository.saveAndFlush(space);

    assertThat(documentRepository.search("%배포%")).isEmpty();
  }

  @Test
  void search_literalPercent_matchesOnlyLiteral() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    save(space.getId(), "할인 100% 적용", "");
    save(space.getId(), "할인 1000 적용", "");

    List<Document> result = documentRepository.search("%100\\%%");

    assertThat(result).extracting(Document::getTitle).containsExactly("할인 100% 적용");
  }

  @Test
  void findTrashed_returnsDeletedDocsOnlyInLiveSpaces() {
    Space live = spaceRepository.save(Space.create("살아있음", null, 1L));
    Space dead = spaceRepository.save(Space.create("삭제됨", null, 1L));
    Document trashed = save(live.getId(), "휴지통 문서", "");
    trashed.softDelete();
    Document inDead = save(dead.getId(), "삭제 공간 문서", "");
    inDead.softDelete();
    save(live.getId(), "정상 문서", "");
    dead.softDelete();
    documentRepository.saveAllAndFlush(List.of(trashed, inDead));
    spaceRepository.saveAndFlush(dead);

    assertThat(documentRepository.findTrashed()).extracting(Document::getTitle)
      .containsExactly("휴지통 문서");
  }

  @Test
  void countLiveBySpaceIds_countsOnlyLiveDocuments() {
    Space a = spaceRepository.save(Space.create("A", null, 1L));
    Space b = spaceRepository.save(Space.create("B", null, 1L));
    save(a.getId(), "1", "");
    save(a.getId(), "2", "");
    Document gone = save(a.getId(), "3", "");
    gone.softDelete();
    documentRepository.saveAndFlush(gone);
    save(b.getId(), "4", "");

    var rows = documentRepository.countLiveBySpaceIds(List.of(a.getId(), b.getId()));

    assertThat(rows).extracting(r -> (Long) r[0], r -> (Long) r[1])
      .containsExactlyInAnyOrder(
        org.assertj.core.groups.Tuple.tuple(a.getId(), 2L),
        org.assertj.core.groups.Tuple.tuple(b.getId(), 1L));
  }

  // 프로젝트 본문 페이지는 하위 페이지 수에서 제외
  @Test
  void countLiveBySpaceIds_excludesHomeDocument() {
    Space space = spaceRepository.save(Space.create("A", null, 1L));
    Document home = save(space.getId(), "A", "");
    save(space.getId(), "하위", "");
    space.assignHomeDocument(home.getId());
    spaceRepository.saveAndFlush(space);

    var rows = documentRepository.countLiveBySpaceIds(List.of(space.getId()));

    assertThat(rows).extracting(r -> (Long) r[1]).containsExactly(1L);
  }

  @Test
  // 나중에 만든 페이지를 더 최근에 고쳐도 먼저 만든 페이지가 위
  void listBySpace_orderedByCreatedAt() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Document first = save(space.getId(), "테스트1", "");
    Document second = save(space.getId(), "테스트2", "");
    ReflectionTestUtils.setField(first, "createdAt", Instant.parse("2026-11-01T00:00:00Z"));
    ReflectionTestUtils.setField(first, "updatedAt", Instant.parse("2026-11-01T00:00:00Z"));
    ReflectionTestUtils.setField(second, "createdAt", Instant.parse("2026-11-02T00:00:00Z"));
    ReflectionTestUtils.setField(second, "updatedAt", Instant.parse("2026-11-05T00:00:00Z"));
    documentRepository.saveAllAndFlush(List.of(first, second));

    List<Document> result =
      documentRepository.findBySpaceIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAscIdAsc(space.getId());

    assertThat(result).extracting(Document::getTitle).containsExactly("테스트1", "테스트2");
  }

  // 각자 커밋되는 트랜잭션으로 문서를 만들고, 테스트 후 직접 정리
  private Long commitDocument(Long[] spaceHolder) {
    TransactionTemplate tx = new TransactionTemplate(transactionManager);
    return tx.execute(status -> {
      Space space = spaceRepository.save(Space.create("동시성", null, 1L));
      spaceHolder[0] = space.getId();
      Document doc = documentRepository.save(Document.create(space.getId(), "원래 제목", 1L));
      doc.updateContent(new byte[] {1}, "원래 본문", 1L);
      return doc.getId();
    });
  }

  private void cleanUp(Long documentId, Long spaceId) {
    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
      documentRepository.deleteById(documentId);
      spaceRepository.deleteById(spaceId);
    });
  }

  // 별도 트랜잭션에서 협업 저장을 커밋
  private void commitContent(Long documentId, byte[] state, String plainText) {
    TransactionTemplate inner = new TransactionTemplate(transactionManager);
    inner.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    inner.executeWithoutResult(status ->
      documentRepository.findById(documentId).orElseThrow().updateContent(state, plainText, 2L));
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void rename_committedAfterConcurrentSaveContent_keepsNewContent() {
    Long[] spaceId = new Long[1];
    Long documentId = commitDocument(spaceId);
    try {
      // 제목 수정용으로 문서를 읽은 뒤 협업 저장이 먼저 커밋되고 제목 수정이 나중에 커밋됨
      new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
        Document doc = documentRepository.findById(documentId).orElseThrow();
        commitContent(documentId, new byte[] {9, 9}, "새 본문");
        doc.rename("새 제목", 3L);
      });

      Document result = documentRepository.findById(documentId).orElseThrow();
      assertThat(result.getTitle()).isEqualTo("새 제목");
      assertThat(result.getPlainText()).isEqualTo("새 본문");
      assertThat(result.getContentState()).containsExactly(9, 9);
    } finally {
      cleanUp(documentId, spaceId[0]);
    }
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void softDelete_committedAfterConcurrentSaveContent_keepsNewContent() {
    Long[] spaceId = new Long[1];
    Long documentId = commitDocument(spaceId);
    try {
      new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
        Document doc = documentRepository.findById(documentId).orElseThrow();
        commitContent(documentId, new byte[] {7}, "삭제 직전 본문");
        doc.softDelete();
      });

      Document result = documentRepository.findById(documentId).orElseThrow();
      assertThat(result.isDeleted()).isTrue();
      assertThat(result.getPlainText()).isEqualTo("삭제 직전 본문");
      assertThat(result.getContentState()).containsExactly(7);
    } finally {
      cleanUp(documentId, spaceId[0]);
    }
  }

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  void saveContent_committedAfterConcurrentRename_keepsNewTitle() {
    Long[] spaceId = new Long[1];
    Long documentId = commitDocument(spaceId);
    try {
      new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
        Document doc = documentRepository.findById(documentId).orElseThrow();
        TransactionTemplate inner = new TransactionTemplate(transactionManager);
        inner.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        inner.executeWithoutResult(s ->
          documentRepository.findById(documentId).orElseThrow().rename("동시에 바뀐 제목", 3L));
        doc.updateContent(new byte[] {5}, "협업 본문", 2L);
      });

      Document result = documentRepository.findById(documentId).orElseThrow();
      assertThat(result.getTitle()).isEqualTo("동시에 바뀐 제목");
      assertThat(result.getPlainText()).isEqualTo("협업 본문");
    } finally {
      cleanUp(documentId, spaceId[0]);
    }
  }
}
