package dev.jkchappy.portal.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.attachment.dto.AttachmentResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.member.MemberService;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AttachmentServiceTest {

  @Mock
  private AttachmentRepository attachmentRepository;

  @Mock
  private FileStorage fileStorage;

  @Mock
  private DocumentService documentService;

  @Mock
  private MemberService memberService;

  private AttachmentService service() {
    return new AttachmentService(attachmentRepository, fileStorage, documentService,
      memberService);
  }

  private Attachment attachment(Long id, boolean inline) {
    Attachment a = Attachment.create(10L, "a.txt", "stored-" + id, "text/plain", 3L, inline, 1L);
    ReflectionTestUtils.setField(a, "id", id);
    return a;
  }

  @Test
  void upload_toDeletedDocument_throwsNotFound() {
    when(documentService.getLiveDocument(10L)).thenThrow(new BusinessException(ErrorCode.NOT_FOUND));
    MockMultipartFile file = new MockMultipartFile("file", "a.txt", "text/plain", "abc".getBytes());

    assertThatThrownBy(() -> service().upload(10L, file, false, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    verify(fileStorage, never()).save(any(InputStream.class));
  }

  @Test
  void upload_dbFailure_deletesStoredFile() {
    when(fileStorage.save(any(InputStream.class))).thenReturn("stored-x");
    when(attachmentRepository.save(any(Attachment.class))).thenThrow(new IllegalStateException("db"));
    MockMultipartFile file = new MockMultipartFile("file", "a.txt", "text/plain", "abc".getBytes());

    assertThatThrownBy(() -> service().upload(10L, file, false, 1L))
      .isInstanceOf(IllegalStateException.class);
    verify(fileStorage).delete("stored-x");
  }

  @Test
  void list_excludesInlineImages() {
    when(attachmentRepository.findByDocumentIdAndInlineFalseOrderByCreatedAtDesc(10L))
      .thenReturn(List.of(attachment(1L, false)));
    when(memberService.findNamesByIds(Set.of(1L))).thenReturn(Map.of(1L, "홍길동"));

    List<AttachmentResponse> result = service().list(10L);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).uploadedByName()).isEqualTo("홍길동");
    assertThat(result.get(0).url()).isEqualTo("/api/attachments/1/download");
    verify(documentService).getLiveDocument(10L);
  }

  @Test
  void delete_removesFileAndRow() {
    Attachment a = attachment(1L, false);
    when(attachmentRepository.findById(1L)).thenReturn(Optional.of(a));

    service().delete(1L);

    verify(attachmentRepository).delete(a);
    verify(fileStorage).delete("stored-1");
  }
}
