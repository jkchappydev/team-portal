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
import java.util.ArrayList;
import java.util.Arrays;
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
      new ContactValues("담당자" + id, null, null, null, null, List.of(), null), sortOrder, 1L);
    ReflectionTestUtils.setField(contact, "id", id);
    return contact;
  }

  // 앞뒤 공백 제거, 빈 값은 null, 전화번호 하이픈 정리, 프로젝트는 빈 이름·중복 제거 후 맨 아래에 놓임
  @Test
  void create_normalizesValuesAndGoesLast() {
    when(contactRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(contact(1L, 0), contact(2L, 3)));
    when(contactRepository.save(any(ExternalContact.class))).thenAnswer(inv -> inv.getArgument(0));

    ContactResponse created = service().create(new ContactRequest(" 홍길동 ", " 가나출판 ", " ", "01012345678", " ",
      Arrays.asList(" 교과서 개발 ", "", null, "교과서 개발", "전자책"), " "), 5L);

    assertThat(created.name()).isEqualTo("홍길동");
    assertThat(created.company()).isEqualTo("가나출판");
    assertThat(created.email()).isNull();
    assertThat(created.phone()).isEqualTo("010-1234-5678");
    assertThat(created.phone2()).isNull();
    assertThat(created.memo()).isNull();
    assertThat(created.projects()).containsExactly("교과서 개발", "전자책");
    verify(contactRepository).save(org.mockito.ArgumentMatchers.argThat(c -> c.getSortOrder() == 4));
  }

  // 전화번호에 허용하지 않는 글자가 있으면 거부
  @Test
  void create_invalidPhone_throwsInvalidInput() {
    assertThatThrownBy(() -> service().create(new ContactRequest("홍길동", null, null, "전화 없음", null, null, null), 1L))
      .isInstanceOf(BusinessException.class)
      .extracting(e -> ((BusinessException) e).getErrorCode())
      .isEqualTo(ErrorCode.INVALID_INPUT);
  }

  // 수정하면 연관 프로젝트 목록을 통째로 바꿈
  @Test
  void update_replacesProjects() {
    ExternalContact existing = ExternalContact.create(
      new ContactValues("홍길동", null, null, null, null, new ArrayList<>(List.of("예전 프로젝트")), null), 0, 1L);
    ReflectionTestUtils.setField(existing, "id", 7L);
    when(contactRepository.findById(7L)).thenReturn(Optional.of(existing));

    ContactResponse updated = service().update(7L,
      new ContactRequest("홍길동", "가나출판", "hong@example.com", "02-123-4567", "0311234567",
        List.of("새 프로젝트"), " 오전에만 통화 가능 "));

    assertThat(updated.projects()).containsExactly("새 프로젝트");
    assertThat(updated.email()).isEqualTo("hong@example.com");
    assertThat(updated.phone()).isEqualTo("02-123-4567");
    assertThat(updated.phone2()).isEqualTo("031-123-4567");
    assertThat(updated.memo()).isEqualTo("오전에만 통화 가능");
  }

  // 끌어 옮긴 연락처를 원하는 위치에 넣고 0부터 다시 번호를 매김
  @Test
  void move_reordersFromZero() {
    ExternalContact a = contact(1L, 0);
    ExternalContact b = contact(2L, 1);
    ExternalContact c = contact(3L, 2);
    when(contactRepository.findById(3L)).thenReturn(Optional.of(c));
    when(contactRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(a, b, c));

    service().move(3L, 0);

    assertThat(List.of(c.getSortOrder(), a.getSortOrder(), b.getSortOrder())).containsExactly(0, 1, 2);
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
