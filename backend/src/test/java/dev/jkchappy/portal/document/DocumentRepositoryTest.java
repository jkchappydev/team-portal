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

  // 메인 화면 최근 수정된 게시글: 수정 시각 최신순(먼저 만들었어도 나중에 고친 글이 위), WBS·삭제된 문서·삭제된 공간의 문서 제외, 개수 제한
  @Test
  void findRecentlyUpdated_newestFirst_excludesWbsAndDeleted() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Space removedSpace = spaceRepository.save(Space.create("보관", null, 1L));
    Instant base = Instant.parse("2999-01-01T00:00:00Z");
    // 먼저 만들었지만 가장 나중에 고친 글
    Document edited = updatedAt(Document.create(space.getId(), "고친 예전 글", 1L), base.plusSeconds(90));
    Document newer = updatedAt(Document.create(space.getId(), "새 글", 1L), base.plusSeconds(60));
    updatedAt(Document.create(space.getId(), "오래된 글", 1L), base);
    updatedAt(Document.createWbs(space.getId(), "일정", 1L), base.plusSeconds(120));
    Document deleted = Document.create(space.getId(), "지운 글", 1L);
    deleted.softDelete();
    updatedAt(deleted, base.plusSeconds(180));
    updatedAt(Document.create(removedSpace.getId(), "보관 공간 글", 1L), base.plusSeconds(240));
    removedSpace.softDelete();
    spaceRepository.saveAndFlush(removedSpace);

    assertThat(documentRepository.findRecentlyUpdated(2)).extracting(Document::getId)
      .containsExactly(edited.getId(), newer.getId());
  }

  @Autowired
  private jakarta.persistence.EntityManager entityManager;

  // V35의 채우기 SQL을 지금 데이터에 다시 실행 (테이블은 마이그레이션으로 이미 있음)
  private void runBackfillSeed() throws Exception {
    String sql = new String(getClass().getResourceAsStream("/db/migration/V35__create_page_block_backfill.sql")
      .readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    for (String statement : sql.split(";")) {
      String body = statement.lines().filter(l -> !l.trim().startsWith("--")).reduce("", (a, b) -> a + "\n" + b).trim();
      if (body.toUpperCase().startsWith("INSERT")) {
        entityManager.createNativeQuery(body).executeUpdate();
      }
    }
  }

  // 페이지 블록 자동 삽입 대상: 살아 있는 PAGE·FILE 하위가 있는 페이지, 최상위 항목이 있는 프로젝트의 본문
  // 삭제된 하위·WBS만 있는 상위와 삭제된 프로젝트는 제외, 가져가기는 한 번만 1을 돌려줌
  @Test
  void pageBlockBackfill_seedsParentsWithLiveChildren_andClaimsOnce() throws Exception {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Document home = documentRepository.saveAndFlush(Document.create(space.getId(), "개발", 1L));
    space.assignHomeDocument(home.getId());
    spaceRepository.saveAndFlush(space);
    Document top = documentRepository.saveAndFlush(Document.create(space.getId(), "배포 절차", 1L));
    Document child = Document.create(space.getId(), "하위", 1L);
    child.placeUnder(top.getId());
    documentRepository.saveAndFlush(child);
    Document onlyWbs = documentRepository.saveAndFlush(Document.create(space.getId(), "일정 모음", 1L));
    Document wbs = Document.createWbs(space.getId(), "일정", 1L);
    wbs.placeUnder(onlyWbs.getId());
    documentRepository.saveAndFlush(wbs);
    Document onlyDeleted = documentRepository.saveAndFlush(Document.create(space.getId(), "지운 하위만", 1L));
    Document gone = Document.create(space.getId(), "지운 하위", 1L);
    gone.placeUnder(onlyDeleted.getId());
    gone.softDelete();
    documentRepository.saveAndFlush(gone);
    Space empty = spaceRepository.save(Space.create("빈 프로젝트", null, 1L));
    Document emptyHome = documentRepository.saveAndFlush(Document.create(empty.getId(), "빈 프로젝트", 1L));
    empty.assignHomeDocument(emptyHome.getId());
    spaceRepository.saveAndFlush(empty);

    runBackfillSeed();

    assertThat(documentRepository.claimPageBlockBackfill(home.getId())).isEqualTo(1);
    assertThat(documentRepository.claimPageBlockBackfill(home.getId())).isZero();
    assertThat(documentRepository.claimPageBlockBackfill(top.getId())).isEqualTo(1);
    assertThat(documentRepository.claimPageBlockBackfill(onlyWbs.getId())).isZero();
    assertThat(documentRepository.claimPageBlockBackfill(onlyDeleted.getId())).isZero();
    assertThat(documentRepository.claimPageBlockBackfill(emptyHome.getId())).isZero();
  }

  private Document updatedAt(Document doc, Instant at) {
    ReflectionTestUtils.setField(doc, "updatedAt", at);
    return documentRepository.saveAndFlush(doc);
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
