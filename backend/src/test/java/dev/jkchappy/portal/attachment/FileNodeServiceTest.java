package dev.jkchappy.portal.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.attachment.dto.AttachmentResponse;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.document.dto.DocumentSummary;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FileNodeServiceTest {

  @Mock
  private DocumentService documentService;

  @Mock
  private AttachmentService attachmentService;

  private FileNodeService service() {
    return new FileNodeService(documentService, attachmentService);
  }

  private Document fileDoc(Long id, String name) {
    Document doc = Document.createFile(10L, name, 1L);
    ReflectionTestUtils.setField(doc, "id", id);
    return doc;
  }

  private AttachmentResponse attachment(Long id) {
    return new AttachmentResponse(id, "a", "application/octet-stream", 1L, "홍길동", null, "/api/attachments/" + id + "/download");
  }

  @Test
  void upload_createsFileNodeAndLinksAttachment() {
    MockMultipartFile file = new MockMultipartFile("file", "C:\\fakepath\\품의서 양식.xlsx",
      "application/octet-stream", "x".getBytes());
    when(documentService.createFile(10L, "품의서 양식.xlsx", 5L, 1L)).thenReturn(fileDoc(7L, "품의서 양식.xlsx"));
    when(attachmentService.upload(7L, file, false, 1L)).thenReturn(attachment(30L));
    DocumentSummary summary = new DocumentSummary(7L, 10L, "개발", "품의서 양식.xlsx", "📊", "홍길동", null, 5L,
      "FILE", "/api/attachments/30/download");
    when(documentService.getSummary(7L)).thenReturn(summary);

    var result = service().upload(10L, 5L, null, file, 1L);

    verify(documentService).attachFile(7L, 30L);
    // 위치를 정하지 않으면 맨 아래 그대로 (이동 없음)
    verify(documentService, never()).move(anyLong(), any(), any());
    assertThat(result.fileUrl()).isEqualTo("/api/attachments/30/download");
  }

  @Test
  void upload_withIndex_movesToPosition() {
    MockMultipartFile file = new MockMultipartFile("file", "회의록 양식.docx", "application/octet-stream", "x".getBytes());
    when(documentService.createFile(10L, "회의록 양식.docx", null, 1L)).thenReturn(fileDoc(8L, "회의록 양식.docx"));
    when(attachmentService.upload(8L, file, false, 1L)).thenReturn(attachment(31L));

    service().upload(10L, null, 0, file, 1L);

    verify(documentService).move(8L, null, 0);
  }

  // 제목 컬럼 길이(200자)를 넘는 파일 이름은 잘라서 항목 제목으로 사용
  @Test
  void upload_longName_truncatesTitle() {
    String longName = "가".repeat(230) + ".pdf";
    MockMultipartFile file = new MockMultipartFile("file", longName, "application/pdf", "x".getBytes());
    when(documentService.createFile(eq(10L), any(), eq(null), eq(1L))).thenAnswer(inv -> {
      assertThat(inv.<String>getArgument(1)).hasSize(200);
      return fileDoc(9L, "x.pdf");
    });
    when(attachmentService.upload(9L, file, false, 1L)).thenReturn(attachment(32L));

    service().upload(10L, null, null, file, 1L);

    verify(documentService).attachFile(9L, 32L);
  }
}
