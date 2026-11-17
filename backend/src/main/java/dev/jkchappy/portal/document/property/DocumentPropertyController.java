package dev.jkchappy.portal.document.property;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.document.property.dto.PropertyCreateRequest;
import dev.jkchappy.portal.document.property.dto.PropertyNameRequest;
import dev.jkchappy.portal.document.property.dto.PropertyOrderRequest;
import dev.jkchappy.portal.document.property.dto.PropertyResponse;
import dev.jkchappy.portal.document.property.dto.PropertyValueRequest;
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

// 페이지 속성 (팀원 모두가 보고 고침)
@RestController
@RequestMapping("/api/documents/{documentId}/properties")
@RequiredArgsConstructor
public class DocumentPropertyController {

  private final DocumentPropertyService propertyService;

  @GetMapping
  public ApiResponse<List<PropertyResponse>> list(@PathVariable Long documentId, @CurrentUser Long userId) {
    return ApiResponse.ok(propertyService.list(documentId));
  }

  @PostMapping
  public ApiResponse<PropertyResponse> create(@PathVariable Long documentId,
    @Valid @RequestBody PropertyCreateRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(propertyService.create(documentId, request.name(), request.type(), userId));
  }

  @PatchMapping("/{propertyId}/name")
  public ApiResponse<PropertyResponse> rename(@PathVariable Long documentId, @PathVariable Long propertyId,
    @Valid @RequestBody PropertyNameRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(propertyService.rename(documentId, propertyId, request.name(), userId));
  }

  @PutMapping("/{propertyId}/value")
  public ApiResponse<PropertyResponse> changeValue(@PathVariable Long documentId, @PathVariable Long propertyId,
    @Valid @RequestBody PropertyValueRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(propertyService.changeValue(documentId, propertyId, request.value(), userId));
  }

  @PatchMapping("/{propertyId}/order")
  public ApiResponse<List<PropertyResponse>> move(@PathVariable Long documentId, @PathVariable Long propertyId,
    @Valid @RequestBody PropertyOrderRequest request, @CurrentUser Long userId) {
    return ApiResponse.ok(propertyService.move(documentId, propertyId, request.index()));
  }

  @DeleteMapping("/{propertyId}")
  public ApiResponse<Void> delete(@PathVariable Long documentId, @PathVariable Long propertyId,
    @CurrentUser Long userId) {
    propertyService.delete(documentId, propertyId, userId);
    return ApiResponse.ok(null);
  }
}
