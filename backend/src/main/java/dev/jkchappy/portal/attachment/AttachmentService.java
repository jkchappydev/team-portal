package dev.jkchappy.portal.attachment;

import dev.jkchappy.portal.attachment.dto.AttachmentResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.member.MemberService;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class AttachmentService {

  private final AttachmentRepository attachmentRepository;
  private final FileStorage fileStorage;
  private final DocumentService documentService;
  private final MemberService memberService;

  public record Download(Attachment attachment, Resource resource) {
  }

  // 삭제된 문서에는 업로드 불가, 파일 저장 후 DB 저장 실패/롤백 시 저장된 파일 삭제
  @Transactional
  public AttachmentResponse upload(Long documentId, MultipartFile file, boolean inline,
    Long userId) {
    documentService.getLiveDocument(documentId);
    if (file == null || file.isEmpty()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "비어 있는 파일은 업로드할 수 없습니다.");
    }
    String storedName;
    try (InputStream in = file.getInputStream()) {
      storedName = fileStorage.save(in);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    registerRollbackCleanup(storedName);
    Attachment saved;
    try {
      saved = attachmentRepository.save(Attachment.create(documentId,
        UploadFiles.sanitizeName(file.getOriginalFilename()), storedName,
        UploadFiles.resolveContentType(file), file.getSize(), inline, userId));
    } catch (RuntimeException e) {
      fileStorage.delete(storedName);
      throw e;
    }
    Map<Long, String> names = memberService.findNamesByIds(Set.of(userId));
    return AttachmentResponse.from(saved, names.getOrDefault(userId, ""));
  }

  // 본문 이미지(inline)를 제외한 첨부 목록을 최신순으로 조회
  @Transactional(readOnly = true)
  public List<AttachmentResponse> list(Long documentId) {
    documentService.getLiveDocument(documentId);
    List<Attachment> attachments =
      attachmentRepository.findByDocumentIdAndInlineFalseOrderByCreatedAtDesc(documentId);
    Map<Long, String> names = memberService.findNamesByIds(new HashSet<>(
      attachments.stream().map(Attachment::getUploadedBy).toList()));
    return attachments.stream()
      .map(a -> AttachmentResponse.from(a, names.getOrDefault(a.getUploadedBy(), "")))
      .toList();
  }

  @Transactional(readOnly = true)
  public Download download(Long id) {
    Attachment attachment = getAttachment(id);
    return new Download(attachment, fileStorage.load(attachment.getStoredName()));
  }

  // DB 행과 파일을 함께 하드 삭제 (파일 삭제 실패 시 행 삭제도 롤백)
  @Transactional
  public void delete(Long id) {
    Attachment attachment = getAttachment(id);
    attachmentRepository.delete(attachment);
    fileStorage.delete(attachment.getStoredName());
  }

  private Attachment getAttachment(Long id) {
    return attachmentRepository.findById(id)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  // 트랜잭션이 롤백되면 이미 저장된 파일 정리
  private void registerRollbackCleanup(String storedName) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCompletion(int status) {
        if (status != STATUS_COMMITTED) {
          fileStorage.delete(storedName);
        }
      }
    });
  }
}
