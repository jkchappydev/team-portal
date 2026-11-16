package dev.jkchappy.portal.contact;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.contact.dto.ContactPositionRequest;
import dev.jkchappy.portal.contact.dto.ContactRequest;
import dev.jkchappy.portal.contact.dto.ContactResponse;
import dev.jkchappy.portal.member.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 외부 연락처 (팀원 모두가 같은 목록을 보고 추가·수정·삭제)
@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
public class ExternalContactController {

  private final ExternalContactService contactService;

  @GetMapping
  public ApiResponse<List<ContactResponse>> list(@CurrentUser Long userId) {
    return ApiResponse.ok(contactService.findAll());
  }

  @PostMapping
  public ApiResponse<ContactResponse> create(@Valid @RequestBody ContactRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(contactService.create(request, userId));
  }

  @PutMapping("/{id}")
  public ApiResponse<ContactResponse> update(@PathVariable Long id, @Valid @RequestBody ContactRequest request,
    @CurrentUser Long userId) {
    return ApiResponse.ok(contactService.update(id, request));
  }

  // 목록에서 끌어 옮긴 연락처 순서 변경
  @PatchMapping("/{id}/position")
  public ApiResponse<Void> move(@PathVariable Long id, @Valid @RequestBody ContactPositionRequest request,
    @CurrentUser Long userId) {
    contactService.move(id, request.index());
    return ApiResponse.ok(null);
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable Long id, @CurrentUser Long userId) {
    contactService.delete(id);
    return ApiResponse.ok(null);
  }
}
