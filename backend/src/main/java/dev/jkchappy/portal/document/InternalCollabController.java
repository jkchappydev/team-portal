package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.ApiResponse;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.CollabContentRequest;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.collab.CollabTicketService;
import jakarta.validation.Valid;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// 협업 서버 전용 내부 API
@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalCollabController {

  private final DocumentService documentService;
  private final MemberService memberService;
  private final CollabTicketService tickets;

  // 문서가 살아 있고 사용자가 활성일 때만 접속 허용
  @GetMapping("/collab/authorize")
  public ApiResponse<Map<String, Object>> authorize(
    @RequestParam Long documentId, @RequestParam String ticket) {
    Long userId = tickets.consume(ticket).orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED));
    documentService.getLiveDocument(documentId);
    return ApiResponse.ok(Map.of("userId", userId, "userName", memberService.getActiveMember(userId).getName()));
  }

  @GetMapping("/documents/{id}/content")
  public ApiResponse<Map<String, String>> getContent(@PathVariable Long id) {
    byte[] state = documentService.getLiveDocument(id).getContentState();
    // 아직 본문이 없으면 null
    Map<String, String> body = new HashMap<>();
    body.put("state", state == null ? null : Base64.getEncoder().encodeToString(state));
    return ApiResponse.ok(body);
  }

  @PutMapping("/documents/{id}/content")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void putContent(@PathVariable Long id, @Valid @RequestBody CollabContentRequest request) {
    // 잘못된 Base64는 400으로 처리
    byte[] state;
    try {
      state = Base64.getDecoder().decode(request.state());
    } catch (IllegalArgumentException e) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "state가 올바른 Base64 형식이 아닙니다.");
    }
    documentService.saveContent(id, state, request.plainText(), request.updatedBy());
  }
}
