package dev.jkchappy.portal.form;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.form.dto.FormResponse;
import dev.jkchappy.portal.member.MemberService;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class FormTemplateServiceTest {

  @Mock
  private FormTemplateRepository formRepository;

  @Mock
  private FileStorage fileStorage;

  @Mock
  private MemberService memberService;

  private FormTemplateService service() {
    return new FormTemplateService(formRepository, fileStorage, memberService);
  }

  private FormTemplate form(Long id, int sortOrder) {
    FormTemplate form = FormTemplate.create("양식" + id + ".docx", "stored-" + id, "application/octet-stream",
      3L, sortOrder, 1L);
    ReflectionTestUtils.setField(form, "id", id);
    return form;
  }

  @Test
  void upload_emptyFile_throwsInvalidInput() {
    MockMultipartFile file = new MockMultipartFile("file", "a.docx", "application/octet-stream", new byte[0]);

    assertThatThrownBy(() -> service().upload(file, 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    verify(fileStorage, never()).save(any());
  }

  // 새 양식은 맨 아래 순서로 저장하고 경로가 섞인 이름은 파일 이름만 남김
  @Test
  void upload_placesNewFormAtBottom() {
    when(formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc()).thenReturn(List.of(form(1L, 0), form(2L, 4)));
    when(fileStorage.save(any(InputStream.class))).thenReturn("stored-new");
    when(formRepository.save(any(FormTemplate.class))).thenAnswer(invocation -> {
      FormTemplate saved = invocation.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 9L);
      return saved;
    });
    when(memberService.findNamesByIds(any())).thenReturn(Map.of(1L, "가나다"));
    MockMultipartFile file = new MockMultipartFile("file", "C:\\temp\\휴가 신청서.hwp", "application/x-hwp",
      "abc".getBytes());

    FormResponse response = service().upload(file, 1L);

    ArgumentCaptor<FormTemplate> captor = ArgumentCaptor.forClass(FormTemplate.class);
    verify(formRepository).save(captor.capture());
    assertThat(captor.getValue().getSortOrder()).isEqualTo(5);
    assertThat(response.name()).isEqualTo("휴가 신청서.hwp");
    assertThat(response.uploadedByName()).isEqualTo("가나다");
    assertThat(response.url()).isEqualTo("/api/forms/9/download");
  }

  // DB 저장이 실패하면 이미 저장한 파일을 지움
  @Test
  void upload_saveFails_deletesStoredFile() {
    when(formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc()).thenReturn(List.of());
    when(fileStorage.save(any(InputStream.class))).thenReturn("stored-new");
    when(formRepository.save(any(FormTemplate.class))).thenThrow(new IllegalStateException("db"));
    MockMultipartFile file = new MockMultipartFile("file", "a.docx", "application/octet-stream", "abc".getBytes());

    assertThatThrownBy(() -> service().upload(file, 1L)).isInstanceOf(IllegalStateException.class);
    verify(fileStorage).delete("stored-new");
  }

  @Test
  void move_insertsAtIndexAndRenumbers() {
    FormTemplate a = form(1L, 0);
    FormTemplate b = form(2L, 1);
    FormTemplate c = form(3L, 2);
    when(formRepository.findById(3L)).thenReturn(Optional.of(c));
    when(formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc()).thenReturn(List.of(a, b, c));

    service().move(3L, 0);

    assertThat(List.of(c.getSortOrder(), a.getSortOrder(), b.getSortOrder())).containsExactly(0, 1, 2);
  }

  // 삭제는 휴지통으로 이동만 하고 행과 파일 본체는 남김
  @Test
  void delete_movesToTrashWithoutRemovingRowOrFile() {
    FormTemplate a = form(1L, 0);
    when(formRepository.findById(1L)).thenReturn(Optional.of(a));

    service().delete(1L);

    assertThat(a.isDeleted()).isTrue();
    verify(formRepository, never()).delete(any(FormTemplate.class));
    verify(fileStorage, never()).delete(any());
  }

  // 휴지통에 있는 파일은 보관함에서 내려받을 수 없음
  @Test
  void download_trashed_throwsNotFound() {
    FormTemplate a = form(1L, 0);
    a.softDelete();
    when(formRepository.findById(1L)).thenReturn(Optional.of(a));

    assertThatThrownBy(() -> service().download(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  // 되살린 파일은 보관함 목록 맨 아래로
  @Test
  void restore_placesFormAtBottom() {
    FormTemplate trashed = form(3L, 0);
    trashed.softDelete();
    when(formRepository.findById(3L)).thenReturn(Optional.of(trashed));
    when(formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc()).thenReturn(List.of(form(1L, 0), form(2L, 6)));

    service().restore(3L);

    assertThat(trashed.isDeleted()).isFalse();
    assertThat(trashed.getSortOrder()).isEqualTo(7);
  }

  @Test
  void restore_notInTrash_throwsInvalidInput() {
    when(formRepository.findById(1L)).thenReturn(Optional.of(form(1L, 0)));

    assertThatThrownBy(() -> service().restore(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void findTrash_listsTrashedFormsAsFormItems() {
    FormTemplate trashed = form(4L, 0);
    trashed.softDelete();
    when(formRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc()).thenReturn(List.of(trashed));

    var items = service().findTrash();

    assertThat(items).hasSize(1);
    assertThat(items.get(0).kind()).isEqualTo("form");
    assertThat(items.get(0).id()).isEqualTo(4L);
    assertThat(items.get(0).name()).isEqualTo("양식4.docx");
    assertThat(items.get(0).children()).isEmpty();
    assertThat(items.get(0).location()).isEqualTo("공유 보관함");
  }

  // 영구 삭제는 휴지통에 있는 파일만, 행과 파일 본체를 지움
  @Test
  void purge_trashed_removesRowAndFile() {
    FormTemplate trashed = form(1L, 0);
    trashed.softDelete();
    when(formRepository.findById(1L)).thenReturn(Optional.of(trashed));

    service().purge(1L);

    verify(formRepository).delete(trashed);
    verify(fileStorage).delete("stored-1");
  }

  @Test
  void purge_notInTrash_throwsInvalidInput() {
    when(formRepository.findById(1L)).thenReturn(Optional.of(form(1L, 0)));

    assertThatThrownBy(() -> service().purge(1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    verify(fileStorage, never()).delete(any());
  }

  @Test
  void download_missing_throwsNotFound() {
    when(formRepository.findById(5L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().download(5L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }
}
