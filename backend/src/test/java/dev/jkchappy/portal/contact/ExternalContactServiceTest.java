package dev.jkchappy.portal.contact;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.contact.ExternalContact.ContactValues;
import dev.jkchappy.portal.contact.dto.ContactRequest;
import dev.jkchappy.portal.contact.dto.ContactResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ExternalContactServiceTest {

  @Mock
  private ExternalContactRepository contactRepository;

  private ExternalContactService service() {
    return new ExternalContactService(contactRepository);
  }

  private ExternalContact contact(long id, int sortOrder) {
    ExternalContact contact = ExternalContact.create(
      new ContactValues("담당자" + id, null, null, null, null, null, null, null), sortOrder, 1L);
    ReflectionTestUtils.setField(contact, "id", id);
    return contact;
  }

  // 앞뒤 공백 제거, 빈 값은 null, 전화번호 하이픈 정리, 연관 프로젝트는 글 그대로 저장, 맨 아래에 놓임
  @Test
  void create_normalizesValuesAndGoesLast() {
    when(contactRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(contact(1L, 0), contact(2L, 3)));
    when(contactRepository.save(any(ExternalContact.class))).thenAnswer(inv -> inv.getArgument(0));

    ContactResponse created = service().create(new ContactRequest(" 홍길동 ", " 가나출판 ", " ", "01012345678", " ",
      " 교과서 개발, 전자책 ", " ", " "), 5L);

    assertThat(created.name()).isEqualTo("홍길동");
    assertThat(created.company()).isEqualTo("가나출판");
    assertThat(created.email()).isNull();
    assertThat(created.phone()).isEqualTo("010-1234-5678");
    assertThat(created.phone2()).isNull();
    assertThat(created.memo()).isNull();
    // 색을 고르지 않으면 null (화면에서 자동 색)
    assertThat(created.color()).isNull();
    assertThat(created.project()).isEqualTo("교과서 개발, 전자책");
    verify(contactRepository).save(org.mockito.ArgumentMatchers.argThat(c -> c.getSortOrder() == 4));
  }

  // 전화번호에 허용하지 않는 글자가 있으면 거부
  @Test
  void create_invalidPhone_throwsInvalidInput() {
    assertThatThrownBy(() -> service().create(new ContactRequest("홍길동", null, null, "전화 없음", null, null, null, null), 1L))
      .isInstanceOf(BusinessException.class)
      .extracting(e -> ((BusinessException) e).getErrorCode())
      .isEqualTo(ErrorCode.INVALID_INPUT);
  }

  // 수정하면 모든 항목을 새 값으로 바꿈
  @Test
  void update_replacesValues() {
    ExternalContact existing = ExternalContact.create(
      new ContactValues("홍길동", null, null, null, null, "예전 프로젝트", null, null), 0, 1L);
    ReflectionTestUtils.setField(existing, "id", 7L);
    when(contactRepository.findById(7L)).thenReturn(Optional.of(existing));

    ContactResponse updated = service().update(7L,
      new ContactRequest("홍길동", "가나출판", "hong@example.com", "02-123-4567", "0311234567",
        "새 프로젝트", " 오전에만 통화 가능 ", "#1971c2"));

    assertThat(updated.project()).isEqualTo("새 프로젝트");
    assertThat(updated.email()).isEqualTo("hong@example.com");
    assertThat(updated.phone()).isEqualTo("02-123-4567");
    assertThat(updated.phone2()).isEqualTo("031-123-4567");
    assertThat(updated.memo()).isEqualTo("오전에만 통화 가능");
    assertThat(updated.color()).isEqualTo("#1971c2");
  }

  @Test
  void delete_missing_throwsNotFound() {
    when(contactRepository.findById(9L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().delete(9L))
      .isInstanceOf(BusinessException.class)
      .extracting(e -> ((BusinessException) e).getErrorCode())
      .isEqualTo(ErrorCode.NOT_FOUND);
  }
}
