package dev.jkchappy.portal.contact;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.contact.ExternalContact.ContactValues;
import dev.jkchappy.portal.contact.dto.ContactRequest;
import dev.jkchappy.portal.contact.dto.ContactResponse;
import dev.jkchappy.portal.member.MemberService;
import java.util.ArrayList;
import java.util.LinkedHashSet;
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

  // 끌어 옮긴 연락처를 index 위치에 끼워 넣고 0부터 다시 번호를 매김
  @Transactional
  public void move(Long id, int index) {
    ExternalContact target = getContact(id);
    List<ExternalContact> contacts = new ArrayList<>(contactRepository.findAllByOrderBySortOrderAscIdAsc()
      .stream().filter(c -> !c.getId().equals(id)).toList());
    contacts.add(Math.clamp(index, 0, contacts.size()), target);
    for (int i = 0; i < contacts.size(); i++) {
      contacts.get(i).changeSortOrder(i);
    }
  }

  @Transactional
  public void delete(Long id) {
    contactRepository.delete(getContact(id));
  }

  // 앞뒤 공백 제거, 빈 값은 null, 연관 프로젝트는 빈 이름·중복 제거
  static ContactValues normalize(ContactRequest request) {
    List<String> projects = request.projects() == null ? List.of()
      : new ArrayList<>(new LinkedHashSet<>(request.projects().stream()
        .filter(p -> p != null && !p.isBlank()).map(String::trim).toList()));
    return new ContactValues(request.name().trim(), blankToNull(request.company()), blankToNull(request.email()),
      normalizePhone(request.phone()), projects);
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
