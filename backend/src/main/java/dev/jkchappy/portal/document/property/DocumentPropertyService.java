package dev.jkchappy.portal.document.property;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.document.property.dto.PropertyResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 페이지 제목 아래 속성 (노션처럼 기본은 담당자, 사용자가 속성을 더하고 순서를 끌어서 바꿈)
@Service
@RequiredArgsConstructor
public class DocumentPropertyService {

  // 처음 열 때 만드는 기본 속성
  static final String DEFAULT_PROPERTY_NAME = "담당자";
  // 사람 속성에 넣을 수 있는 최대 인원
  private static final int MAX_PEOPLE = 20;

  private final DocumentPropertyRepository propertyRepository;
  private final DocumentRepository documentRepository;
  private final DocumentService documentService;

  // 페이지 속성 목록, 처음 한 번은 기본 속성(담당자)을 만듦 (동시에 열어도 한 번만 만들어지도록 표시를 먼저 바꿈)
  @Transactional
  public List<PropertyResponse> list(Long documentId) {
    Document doc = documentService.getLiveDocument(documentId);
    if (!doc.isPropertiesInitialized() && documentRepository.markPropertiesInitialized(documentId) == 1) {
      propertyRepository.save(DocumentProperty.create(documentId, DEFAULT_PROPERTY_NAME, PropertyType.PERSON, null, 0));
    }
    return responses(documentId);
  }

  // 새 속성은 맨 아래, 값은 비어 있음
  @Transactional
  public PropertyResponse create(Long documentId, String name, PropertyType type, Long userId) {
    Document doc = documentService.getLiveDocument(documentId);
    int sortOrder = propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(documentId).stream()
      .mapToInt(DocumentProperty::getSortOrder).max().orElse(-1) + 1;
    DocumentProperty saved = propertyRepository.save(DocumentProperty.create(documentId, name.trim(), type, null, sortOrder));
    doc.touch(userId);
    return PropertyResponse.from(saved);
  }

  @Transactional
  public PropertyResponse rename(Long documentId, Long propertyId, String name, Long userId) {
    DocumentProperty property = getProperty(documentId, propertyId);
    property.rename(name.trim());
    documentService.getLiveDocument(documentId).touch(userId);
    return PropertyResponse.from(property);
  }

  @Transactional
  public PropertyResponse changeValue(Long documentId, Long propertyId, String value, Long userId) {
    DocumentProperty property = getProperty(documentId, propertyId);
    property.changeValue(normalizeValue(property.getType(), value));
    documentService.getLiveDocument(documentId).touch(userId);
    return PropertyResponse.from(property);
  }

  // index 위치로 옮기고 0부터 다시 번호를 매김
  @Transactional
  public List<PropertyResponse> move(Long documentId, Long propertyId, int index) {
    DocumentProperty moving = getProperty(documentId, propertyId);
    List<DocumentProperty> order = new ArrayList<>(propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(documentId));
    order.removeIf(p -> p.getId().equals(moving.getId()));
    order.add(Math.min(index, order.size()), moving);
    for (int i = 0; i < order.size(); i++) {
      order.get(i).changeSortOrder(i);
    }
    return order.stream().map(PropertyResponse::from).toList();
  }

  @Transactional
  public void delete(Long documentId, Long propertyId, Long userId) {
    propertyRepository.delete(getProperty(documentId, propertyId));
    documentService.getLiveDocument(documentId).touch(userId);
  }

  // 페이지 복제: 원본의 속성을 같은 순서로 새 페이지에 복사 (원본이 아직 기본 속성을 만들지 않았으면 새 페이지도 처음 열 때 만듦)
  @Transactional
  public void copyProperties(Long sourceId, Long targetId) {
    Document source = documentService.getLiveDocument(sourceId);
    if (!source.isPropertiesInitialized()) return;
    documentRepository.markPropertiesInitialized(targetId);
    propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(sourceId)
      .forEach(property -> propertyRepository.save(property.copyTo(targetId)));
  }

  // 종류별 값 정리: 비어 있으면 null, 형식이 맞지 않으면 거부
  static String normalizeValue(PropertyType type, String value) {
    String trimmed = value == null ? null : value.strip();
    if (trimmed == null || trimmed.isEmpty()) return null;
    return switch (type) {
      case PERSON -> normalizePeople(trimmed);
      case NUMBER -> normalizeNumber(trimmed);
      case DATE -> normalizeDate(trimmed);
      case CHECKBOX -> "true".equalsIgnoreCase(trimmed) ? "true" : null;
      case TEXT, URL -> trimmed;
    };
  }

  // 팀원 id를 쉼표로 (중복 제거, 고른 순서 유지)
  private static String normalizePeople(String value) {
    List<String> ids = Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    if (ids.size() > MAX_PEOPLE || ids.stream().anyMatch(id -> !id.matches("[1-9][0-9]{0,17}"))) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "담당자를 다시 골라 주세요.");
    }
    return ids.isEmpty() ? null : String.join(",", ids);
  }

  private static String normalizeNumber(String value) {
    try {
      return new BigDecimal(value.replace(",", "")).stripTrailingZeros().toPlainString();
    } catch (NumberFormatException e) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "숫자를 입력해 주세요.");
    }
  }

  private static String normalizeDate(String value) {
    try {
      return LocalDate.parse(value).toString();
    } catch (DateTimeParseException e) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
    }
  }

  private List<PropertyResponse> responses(Long documentId) {
    return propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(documentId).stream()
      .map(PropertyResponse::from).toList();
  }

  // 살아 있는 페이지의 그 페이지 속성만
  private DocumentProperty getProperty(Long documentId, Long propertyId) {
    documentService.getLiveDocument(documentId);
    return propertyRepository.findById(propertyId)
      .filter(p -> p.getDocumentId().equals(documentId))
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }
}
