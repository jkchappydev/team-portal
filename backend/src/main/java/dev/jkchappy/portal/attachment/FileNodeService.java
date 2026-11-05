package dev.jkchappy.portal.attachment;

import dev.jkchappy.portal.attachment.dto.AttachmentResponse;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

// 사이드바 트리에 끌어다 놓은 파일을 파일 항목으로 등록
@Service
@RequiredArgsConstructor
public class FileNodeService {

  // 항목 제목 컬럼 길이
  private static final int MAX_TITLE_LENGTH = 200;

  private final DocumentService documentService;
  private final AttachmentService attachmentService;

  // 파일 항목 생성, 파일 본체 업로드와 연결, 지정 위치로 이동을 한 트랜잭션으로 처리
  // (업로드나 이동이 실패하면 항목도 남지 않고, 저장된 파일은 롤백 시 정리됨)
  @Transactional
  public DocumentSummary upload(Long spaceId, Long parentId, Integer index, MultipartFile file,
    Long userId) {
    String name = UploadFiles.sanitizeName(file == null ? null : file.getOriginalFilename());
    String title = name.length() > MAX_TITLE_LENGTH ? name.substring(0, MAX_TITLE_LENGTH) : name;
    Document doc = documentService.createFile(spaceId, title, parentId, userId);
    AttachmentResponse attachment = attachmentService.upload(doc.getId(), file, false, userId);
    documentService.attachFile(doc.getId(), attachment.id());
    if (index != null) {
      documentService.move(doc.getId(), parentId, index);
    }
    return documentService.getSummary(doc.getId());
  }
}
