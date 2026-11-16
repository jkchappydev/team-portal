package dev.jkchappy.portal.contact.dto;

import dev.jkchappy.portal.contact.ExternalContact;
// 비어 있는 항목은 null
public record ContactResponse(Long id, String name, String company, String email, String phone,
  String phone2, String project, String memo, String color) {

  public static ContactResponse from(ExternalContact contact) {
    return new ContactResponse(contact.getId(), contact.getName(), contact.getCompany(), contact.getEmail(),
      contact.getPhone(), contact.getPhone2(), contact.getProject(), contact.getMemo(), contact.getColor());
  }
}
