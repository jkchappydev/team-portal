package dev.jkchappy.portal.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

// API 오류 코드와 HTTP 상태 매핑
@Getter
public enum ErrorCode {
  INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다."),
  UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
  ACCOUNT_PENDING(HttpStatus.FORBIDDEN, "승인 진행 중입니다."),
  ACCOUNT_REJECTED(HttpStatus.FORBIDDEN, "가입이 거절되었습니다. 관리자에게 문의하세요."),
  MEMBER_INACTIVE(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
  ADMIN_REQUIRED(HttpStatus.FORBIDDEN, "관리자만 할 수 있습니다."),
  LAST_ADMIN(HttpStatus.CONFLICT, "마지막 관리자는 권한을 뺄 수 없습니다."),
  MEMBER_ALREADY_LINKED(HttpStatus.CONFLICT, "이미 다른 구글 계정과 연결된 팀원입니다."),
  REQUEST_ALREADY_DECIDED(HttpStatus.CONFLICT, "이미 처리된 가입 요청입니다."),
  FORBIDDEN(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
  NOT_FOUND(HttpStatus.NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),
  METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "지원하지 않는 요청 방식입니다."),
  UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 요청 형식입니다."),
  FILE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "파일 크기가 허용 한도를 초과했습니다."),
  CS_UNAVAILABLE(HttpStatus.BAD_GATEWAY, "CS 시스템에서 목록을 가져오지 못했습니다."),
  INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

  private final HttpStatus status;
  private final String defaultMessage;

  ErrorCode(HttpStatus status, String defaultMessage) {
    this.status = status;
    this.defaultMessage = defaultMessage;
  }
}
