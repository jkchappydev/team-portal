package dev.jkchappy.portal.document.property;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.document.property.dto.PropertyResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DocumentPropertyServiceTest {

  @Mock
  private DocumentPropertyRepository propertyRepository;

  @Mock
  private DocumentRepository documentRepository;

  @Mock
  private DocumentService documentService;

  private DocumentPropertyService service() {
    return new DocumentPropertyService(propertyRepository, documentRepository, documentService);
  }

  private Document document(long id, boolean initialized) {
    Document doc = Document.create(1L, "회의록", 1L);
    ReflectionTestUtils.setField(doc, "id", id);
    ReflectionTestUtils.setField(doc, "propertiesInitialized", initialized);
    return doc;
  }

  private DocumentProperty property(long id, long documentId, String name, PropertyType type, int sortOrder) {
    DocumentProperty property = DocumentProperty.create(documentId, name, type, null, sortOrder);
    ReflectionTestUtils.setField(property, "id", id);
    return property;
  }

  // 처음 열면 기본 속성(담당자, 사람 종류)을 맨 위에 만듦
  @Test
  void list_firstTime_createsDefaultAssignee() {
    when(documentService.getLiveDocument(5L)).thenReturn(document(5L, false));
    when(documentRepository.markPropertiesInitialized(5L)).thenReturn(1);
    DocumentProperty assignee = property(1L, 5L, "담당자", PropertyType.PERSON, 0);
    when(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of(assignee));

    List<PropertyResponse> result = service().list(5L);

    verify(propertyRepository).save(org.mockito.ArgumentMatchers.argThat(p ->
      p.getName().equals("담당자") && p.getType() == PropertyType.PERSON && p.getSortOrder() == 0));
    assertThat(result).extracting(PropertyResponse::name).containsExactly("담당자");
  }

  // 이미 만든 페이지(담당자를 지운 경우 포함)나 동시에 먼저 만든 요청이 있으면 다시 만들지 않음
  @Test
  void list_alreadyInitializedOrRaced_doesNotCreateAgain() {
    when(documentService.getLiveDocument(5L)).thenReturn(document(5L, true));
    when(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of());
    assertThat(service().list(5L)).isEmpty();

    when(documentService.getLiveDocument(6L)).thenReturn(document(6L, false));
    when(documentRepository.markPropertiesInitialized(6L)).thenReturn(0);
    when(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(6L)).thenReturn(List.of());
    service().list(6L);

    verify(propertyRepository, never()).save(any());
  }

  // 새 속성은 맨 아래, 이름 앞뒤 공백 제거, 페이지 수정자·시각 갱신
  @Test
  void create_goesLastAndTouchesDocument() {
    Document doc = document(5L, true);
    when(documentService.getLiveDocument(5L)).thenReturn(doc);
    when(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(5L))
      .thenReturn(List.of(property(1L, 5L, "담당자", PropertyType.PERSON, 0), property(2L, 5L, "마감", PropertyType.DATE, 3)));
    when(propertyRepository.save(any(DocumentProperty.class))).thenAnswer(inv -> inv.getArgument(0));

    PropertyResponse created = service().create(5L, " 상태 ", PropertyType.TEXT, 9L);

    assertThat(created.name()).isEqualTo("상태");
    assertThat(created.type()).isEqualTo(PropertyType.TEXT);
    verify(propertyRepository).save(org.mockito.ArgumentMatchers.argThat(p -> p.getSortOrder() == 4));
    assertThat(doc.getUpdatedBy()).isEqualTo(9L);
  }

  // 옮긴 위치로 넣고 0부터 다시 번호를 매김
  @Test
  void move_reordersAndRenumbers() {
    when(documentService.getLiveDocument(5L)).thenReturn(document(5L, true));
    DocumentProperty a = property(1L, 5L, "담당자", PropertyType.PERSON, 0);
    DocumentProperty b = property(2L, 5L, "마감", PropertyType.DATE, 1);
    DocumentProperty c = property(3L, 5L, "상태", PropertyType.TEXT, 2);
    when(propertyRepository.findById(3L)).thenReturn(Optional.of(c));
    when(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of(a, b, c));

    List<PropertyResponse> result = service().move(5L, 3L, 0);

    assertThat(result).extracting(PropertyResponse::name).containsExactly("상태", "담당자", "마감");
    assertThat(List.of(c.getSortOrder(), a.getSortOrder(), b.getSortOrder())).containsExactly(0, 1, 2);
  }

  // 다른 페이지의 속성은 찾을 수 없음
  @Test
  void changeValue_propertyOfOtherDocument_throwsNotFound() {
    when(documentService.getLiveDocument(5L)).thenReturn(document(5L, true));
    when(propertyRepository.findById(3L)).thenReturn(Optional.of(property(3L, 99L, "상태", PropertyType.TEXT, 0)));

    assertThatThrownBy(() -> service().changeValue(5L, 3L, "진행", 1L))
      .isInstanceOf(BusinessException.class)
      .extracting(e -> ((BusinessException) e).getErrorCode())
      .isEqualTo(ErrorCode.NOT_FOUND);
  }

  // 종류별 값 정리: 빈 값은 null, 사람은 id 중복 제거, 숫자·날짜는 형식 맞춤, 체크박스는 true만 저장
  @Test
  void normalizeValue_perType() {
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.TEXT, "  ")).isNull();
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.TEXT, " 진행 중 ")).isEqualTo("진행 중");
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.PERSON, "3, 1,3")).isEqualTo("3,1");
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.NUMBER, "1,200.50")).isEqualTo("1200.5");
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.DATE, "2026-11-17")).isEqualTo("2026-11-17");
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.CHECKBOX, "true")).isEqualTo("true");
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.CHECKBOX, "false")).isNull();
    assertThat(DocumentPropertyService.normalizeValue(PropertyType.URL, " https://example.com ")).isEqualTo("https://example.com");
  }

  @Test
  void normalizeValue_invalid_throwsInvalidInput() {
    for (var invalid : List.of(
      new Object[] {PropertyType.PERSON, "홍길동"},
      new Object[] {PropertyType.NUMBER, "열"},
      new Object[] {PropertyType.DATE, "2026/11/17"})) {
      assertThatThrownBy(() -> DocumentPropertyService.normalizeValue((PropertyType) invalid[0], (String) invalid[1]))
        .isInstanceOf(BusinessException.class)
        .extracting(e -> ((BusinessException) e).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_INPUT);
    }
  }

  // 복제: 원본이 기본 속성을 만든 페이지면 표시와 속성을 같은 순서로 복사, 아니면 아무것도 안 함
  @Test
  void copyProperties_copiesWhenSourceInitialized() {
    when(documentService.getLiveDocument(5L)).thenReturn(document(5L, true));
    DocumentProperty assignee = property(1L, 5L, "담당자", PropertyType.PERSON, 0);
    assignee.changeValue("3");
    when(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of(assignee));

    service().copyProperties(5L, 20L);

    verify(documentRepository).markPropertiesInitialized(20L);
    verify(propertyRepository).save(org.mockito.ArgumentMatchers.argThat(p ->
      p.getDocumentId().equals(20L) && p.getName().equals("담당자") && "3".equals(p.getValue())));

    when(documentService.getLiveDocument(6L)).thenReturn(document(6L, false));
    service().copyProperties(6L, 21L);
    verify(documentRepository, never()).markPropertiesInitialized(21L);
  }
}
