package dev.jkchappy.portal.contact.dto;

import dev.jkchappy.portal.contact.ExternalContact;
import java.util.List;

// 비어 있는 항목은 null, 연관 프로젝트가 없으면 빈 목록
public record ContactResponse(Long id, String name, String company, String email, String phone,
  List<String> projects) {

  public static ContactResponse from(ExternalContact contact) {
    return new ContactResponse(contact.getId(), contact.getName(), contact.getCompany(), contact.getEmail(),
      contact.getPhone(), List.copyOf(contact.getProjects()));
  }
}
