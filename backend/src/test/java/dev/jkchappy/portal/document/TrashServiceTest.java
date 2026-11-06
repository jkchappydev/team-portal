package dev.jkchappy.portal.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.attachment.Attachment;
import dev.jkchappy.portal.attachment.AttachmentRepository;
import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.notification.DocumentReadRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

// 실제 DB 참조 제약 아래에서 영구 삭제 순서와 커밋 후 파일 삭제를 검증
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfig.class, TrashService.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class TrashServiceTest {

  @Autowired
  private TrashService trashService;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private DocumentSnapshotRepository snapshotRepository;

  @Autowired
  private DocumentReadRepository documentReadRepository;

  @Autowired
  private AttachmentRepository attachmentRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private PlatformTransactionManager transactionManager;

  @MockitoBean
  private FileStorage fileStorage;

  private Space space() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Document home = documentRepository.save(Document.create(space.getId(), "개발", 1L));
    space.assignHomeDocument(home.getId());
    return spaceRepository.save(space);
  }

  private Document page(Long spaceId, Long parentId) {
    Document doc = Document.create(spaceId, "페이지", 1L);
    doc.placeUnder(parentId);
    return documentRepository.save(doc);
  }

  private Document softDelete(Document doc) {
    doc.softDelete();
    return documentRepository.save(doc);
  }

  private Long member() {
    return jdbcTemplate.queryForObject(
      "insert into member (name, active, created_at) values ('홍길동', true, now()) returning id", Long.class);
  }

  // 페이지에 본문 이미지 첨부, 수정 이력, 확인 기록을 붙이고 저장 이름 반환
  private String decorate(Document doc, Long memberId) {
    String storedName = UUID.randomUUID().toString();
    attachmentRepository.save(Attachment.create(doc.getId(), "a.png", storedName, "image/png", 10, true, 1L));
    snapshotRepository.save(DocumentSnapshot.create(doc.getId(), new byte[] {1}, Instant.now()));
    new TransactionTemplate(transactionManager)
      .executeWithoutResult(status -> documentReadRepository.upsert(memberId, doc.getId(), Instant.now()));
    return storedName;
  }

  private Integer countReads(Long documentId) {
    return jdbcTemplate.queryForObject("select count(*) from document_read where document_id = ?", Integer.class, documentId);
  }

  @Test
  void purgeDocument_removesSubtreeRowsAndFiles() {
    Long memberId = member();
    Space space = space();
    Document parent = softDelete(page(space.getId(), null));
    Document child = page(space.getId(), parent.getId());
    Document grandChild = page(space.getId(), child.getId());
    Document sibling = page(space.getId(), null);
    String parentFile = decorate(parent, memberId);
    String grandChildFile = decorate(grandChild, memberId);
    String siblingFile = decorate(sibling, memberId);

    trashService.purgeDocument(parent.getId());

    assertThat(documentRepository.findAllById(java.util.List.of(parent.getId(), child.getId(), grandChild.getId())))
      .isEmpty();
    assertThat(documentRepository.findById(sibling.getId())).isPresent();
    assertThat(attachmentRepository.findByDocumentIdIn(java.util.List.of(parent.getId(), grandChild.getId()))).isEmpty();
    assertThat(attachmentRepository.findByDocumentIdIn(java.util.List.of(sibling.getId()))).hasSize(1);
    assertThat(snapshotRepository.findFirstByDocumentIdOrderByCreatedAtDesc(parent.getId())).isEmpty();
    assertThat(countReads(grandChild.getId())).isZero();
    assertThat(countReads(sibling.getId())).isEqualTo(1);
    verify(fileStorage).delete(parentFile);
    verify(fileStorage).delete(grandChildFile);
    verify(fileStorage, never()).delete(siblingFile);
  }

  @Test
  void purgeDocument_fileNode_clearsMutualReference() {
    Space space = space();
    Document file = Document.createFile(space.getId(), "보고서.pdf", 1L);
    file = documentRepository.save(file);
    String storedName = UUID.randomUUID().toString();
    Attachment attachment = attachmentRepository.save(
      Attachment.create(file.getId(), "보고서.pdf", storedName, "application/pdf", 10, false, 1L));
    file.attachFile(attachment.getId());
    softDelete(file);

    trashService.purgeDocument(file.getId());

    assertThat(documentRepository.findById(file.getId())).isEmpty();
    assertThat(attachmentRepository.findById(attachment.getId())).isEmpty();
    verify(fileStorage).delete(storedName);
  }

  @Test
  void purgeDocument_livePage_rejected() {
    Space space = space();
    Document live = page(space.getId(), null);

    assertThatThrownBy(() -> trashService.purgeDocument(live.getId()))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    assertThat(documentRepository.findById(live.getId())).isPresent();
  }

  @Test
  void purgeDocument_insideDeletedSpace_rejected() {
    Space space = space();
    Document deleted = softDelete(page(space.getId(), null));
    space.softDelete();
    spaceRepository.save(space);

    assertThatThrownBy(() -> trashService.purgeDocument(deleted.getId()))
      .isInstanceOf(BusinessException.class);
    assertThat(documentRepository.findById(deleted.getId())).isPresent();
  }

  @Test
  void purgeSpace_removesSpaceWithHomeAndAllPages() {
    Long memberId = member();
    Space space = space();
    Long homeId = space.getHomeDocumentId();
    Document page = page(space.getId(), null);
    Document hiddenDeleted = softDelete(page(space.getId(), page.getId()));
    String homeFile = decorate(documentRepository.findById(homeId).orElseThrow(), memberId);
    String pageFile = decorate(hiddenDeleted, memberId);
    space.softDelete();
    spaceRepository.save(space);

    trashService.purgeSpace(space.getId());

    assertThat(spaceRepository.findById(space.getId())).isEmpty();
    assertThat(documentRepository.findBySpaceId(space.getId())).isEmpty();
    verify(fileStorage).delete(homeFile);
    verify(fileStorage).delete(pageFile);
  }

  @Test
  void purgeSpace_liveSpace_rejected() {
    Space space = space();

    assertThatThrownBy(() -> trashService.purgeSpace(space.getId()))
      .isInstanceOf(BusinessException.class);
    assertThat(spaceRepository.findById(space.getId())).isPresent();
    verify(fileStorage, never()).delete(anyString());
  }
}
