package dev.jkchappy.portal.contact.dto;

import dev.jkchappy.portal.contact.ExternalContact;
import java.time.Instant;

// 비어 있는 항목은 null, updatedAt은 마지막으로 추가·수정한 시각 (카드의 최종 수정일)
public record ContactResponse(Long id, String name, String company, String email, String phone,
  String phone2, String project, String memo, String color, Instant updatedAt) {

  public static ContactResponse from(ExternalContact contact) {
    return new ContactResponse(contact.getId(), contact.getName(), contact.getCompany(), contact.getEmail(),
      contact.getPhone(), contact.getPhone2(), contact.getProject(), contact.getMemo(), contact.getColor(),
      contact.getUpdatedAt());
  }
}
