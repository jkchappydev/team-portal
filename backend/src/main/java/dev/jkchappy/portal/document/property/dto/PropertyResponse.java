package dev.jkchappy.portal.document.property.dto;

import dev.jkchappy.portal.document.property.DocumentProperty;
import dev.jkchappy.portal.document.property.PropertyType;

// 값이 비어 있으면 null
public record PropertyResponse(Long id, String name, PropertyType type, String value) {

  public static PropertyResponse from(DocumentProperty property) {
    return new PropertyResponse(property.getId(), property.getName(), property.getType(), property.getValue());
  }
}
