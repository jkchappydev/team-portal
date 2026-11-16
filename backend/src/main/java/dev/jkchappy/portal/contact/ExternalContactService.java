package dev.jkchappy.portal.contact;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.contact.ExternalContact.ContactValues;
import dev.jkchappy.portal.contact.dto.ContactRequest;
import dev.jkchappy.portal.contact.dto.ContactResponse;
import dev.jkchappy.portal.member.MemberService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExternalContactService {

  private final ExternalContactRepository contactRepository;

  @Transactional(readOnly = true)
  public List<ContactResponse> findAll() {
    return contactRepository.findAllByOrderBySortOrderAscIdAsc().stream().map(ContactResponse::from).toList();
  }

  // 새 연락처는 목록 맨 아래
  @Transactional
  public ContactResponse create(ContactRequest request, Long userId) {
    ContactValues values = normalize(request);
    int sortOrder = contactRepository.findAllByOrderBySortOrderAscIdAsc().stream()
      .mapToInt(ExternalContact::getSortOrder).max().orElse(-1) + 1;
    return ContactResponse.from(contactRepository.save(ExternalContact.create(values, sortOrder, userId)));
  }

  @Transactional
  public ContactResponse update(Long id, ContactRequest request) {
    ExternalContact contact = getContact(id);
    contact.change(normalize(request));
    return ContactResponse.from(contact);
  }

  @Transactional
  public void delete(Long id) {
    contactRepository.delete(getContact(id));
  }

  // 앞뒤 공백 제거, 빈 값은 null
  static ContactValues normalize(ContactRequest request) {
    return new ContactValues(request.name().trim(), blankToNull(request.company()), blankToNull(request.email()),
      normalizePhone(request.phone()), normalizePhone(request.phone2()), blankToNull(request.project()),
      blankToNull(request.memo()), blankToNull(request.color()));
  }

  // 선택 값, 숫자·하이픈·괄호·+·공백만 허용 (국내 번호는 팀원 전화번호와 같은 규칙으로 하이픈을 맞춤)
  static String normalizePhone(String phone) {
    String value = blankToNull(phone);
    if (value == null) return null;
    if (!value.matches("[0-9+() -]{7,20}")) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "전화번호는 숫자와 하이픈(-)으로 7~20자 입력해 주세요.");
    }
    String digits = value.replace("-", "").replace(" ", "");
    return digits.matches("[0-9]+") ? MemberService.hyphenatePhone(digits) : value;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private ExternalContact getContact(Long id) {
    return contactRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }
}
