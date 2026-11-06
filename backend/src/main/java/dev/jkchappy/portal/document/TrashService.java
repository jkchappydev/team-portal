package dev.jkchappy.portal.document;

import dev.jkchappy.portal.attachment.Attachment;
import dev.jkchappy.portal.attachment.AttachmentRepository;
import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.notification.DocumentReadRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

// 휴지통 항목 영구 삭제 (페이지·하위 페이지·수정 이력·확인 기록·첨부 행과 파일 본체)
@Slf4j
@Service
@RequiredArgsConstructor
public class TrashService {

  private final DocumentRepository documentRepository;
  private final SpaceRepository spaceRepository;
  private final DocumentSnapshotRepository snapshotRepository;
  private final DocumentReadRepository documentReadRepository;
  private final AttachmentRepository attachmentRepository;
  private final FileStorage fileStorage;

  // 휴지통에 있는 페이지와 그 아래 모든 페이지를 영구 삭제
  @Transactional
  public void purgeDocument(Long id) {
    Document doc = documentRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (!doc.isDeleted()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "휴지통에 있는 페이지만 영구 삭제할 수 있습니다.");
    }
    // 삭제된 최상위 페이지 안의 페이지는 최상위 페이지 영구 삭제로만 지움
    Space space = spaceRepository.findById(doc.getSpaceId())
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (space.isDeleted()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "삭제된 최상위 페이지 안의 페이지는 최상위 페이지를 영구 삭제해야 지울 수 있습니다.");
    }
    purge(subtreeIds(doc.getSpaceId(), id));
  }

  // 휴지통에 있는 최상위 페이지와 그 안의 모든 페이지(본문 포함)를 영구 삭제
  @Transactional
  public void purgeSpace(Long id) {
    Space space = spaceRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (!space.isDeleted()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "휴지통에 있는 페이지만 영구 삭제할 수 있습니다.");
    }
    List<Long> ids = documentRepository.findBySpaceId(id).stream().map(Document::getId).toList();
    spaceRepository.clearHomeDocument(id);
    purge(ids);
    spaceRepository.deleteRow(id);
  }

  // 시작 페이지부터 상위 참조를 따라 내려가며 하위 페이지 ID 수집 (삭제 여부 무관)
  private Set<Long> subtreeIds(Long spaceId, Long rootId) {
    Map<Long, List<Long>> childrenByParent = new HashMap<>();
    for (Document d : documentRepository.findBySpaceId(spaceId)) {
      if (d.getParentId() != null) {
        childrenByParent.computeIfAbsent(d.getParentId(), k -> new ArrayList<>()).add(d.getId());
      }
    }
    Set<Long> result = new LinkedHashSet<>();
    Deque<Long> queue = new ArrayDeque<>(List.of(rootId));
    while (!queue.isEmpty()) {
      Long current = queue.poll();
      // 순환 데이터가 있어도 한 번씩만 방문
      if (result.add(current)) {
        queue.addAll(childrenByParent.getOrDefault(current, List.of()));
      }
    }
    return result;
  }

  // 참조 순서에 맞춰 행을 지우고, 커밋된 뒤에 파일 본체 삭제
  private void purge(Collection<Long> documentIds) {
    if (documentIds.isEmpty()) {
      return;
    }
    List<String> storedNames = attachmentRepository.findByDocumentIdIn(documentIds).stream()
      .map(Attachment::getStoredName)
      .toList();
    documentRepository.clearAttachmentIds(documentIds);
    attachmentRepository.deleteByDocumentIds(documentIds);
    snapshotRepository.deleteByDocumentIds(documentIds);
    documentReadRepository.deleteByDocumentIds(documentIds);
    documentRepository.deleteByIds(documentIds);
    deleteFilesAfterCommit(storedNames);
  }

  // 롤백되면 파일이 남아야 하므로 커밋 후 삭제, 파일 삭제 실패는 로그만 남김
  private void deleteFilesAfterCommit(List<String> storedNames) {
    if (storedNames.isEmpty()) {
      return;
    }
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      deleteFiles(storedNames);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCommit() {
        deleteFiles(storedNames);
      }
    });
  }

  private void deleteFiles(List<String> storedNames) {
    for (String storedName : storedNames) {
      try {
        fileStorage.delete(storedName);
      } catch (RuntimeException e) {
        log.warn("영구 삭제한 첨부 파일 본체를 지우지 못했습니다. storedName={}", storedName, e);
      }
    }
  }
}
