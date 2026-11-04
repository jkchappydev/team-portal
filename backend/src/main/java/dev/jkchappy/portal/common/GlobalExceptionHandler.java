package dev.jkchappy.portal.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

// 예외를 ApiResponse 형식으로 변환
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
    return build(e.getErrorCode(), e.getMessage());
  }

  // 요청 본문 검증 실패는 첫 번째 필드 오류 메시지를 노출
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
    String message = e.getBindingResult().getFieldErrors().stream()
      .findFirst()
      .map(f -> f.getField() + ": " + f.getDefaultMessage())
      .orElse(ErrorCode.INVALID_INPUT.getDefaultMessage());
    return build(ErrorCode.INVALID_INPUT, message);
  }

  // 프레임워크 레벨 잘못된 요청(본문 파싱, 파라미터·파트·헤더 누락/타입, 검증)은 400
  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MissingServletRequestParameterException.class,
    MissingServletRequestPartException.class,
    MissingRequestHeaderException.class,
    MethodArgumentTypeMismatchException.class,
    HandlerMethodValidationException.class,
    ConstraintViolationException.class
  })
  public ResponseEntity<ApiResponse<Void>> handleBadRequest(Exception e) {
    return build(ErrorCode.INVALID_INPUT, ErrorCode.INVALID_INPUT.getDefaultMessage());
  }

  // 허용 메서드는 Allow 헤더로 안내
  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(
    HttpRequestMethodNotSupportedException e) {
    HttpHeaders headers = new HttpHeaders();
    if (e.getSupportedHttpMethods() != null) {
      headers.setAllow(e.getSupportedHttpMethods());
    }
    ErrorCode code = ErrorCode.METHOD_NOT_ALLOWED;
    return ResponseEntity.status(code.getStatus()).headers(headers)
      .body(ApiResponse.fail(code, code.getDefaultMessage()));
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ApiResponse<Void>> handleMediaTypeNotSupported(
    HttpMediaTypeNotSupportedException e) {
    return build(ErrorCode.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE.getDefaultMessage());
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException e) {
    return build(ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.getDefaultMessage());
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<ApiResponse<Void>> handleTooLarge(MaxUploadSizeExceededException e) {
    return build(ErrorCode.FILE_TOO_LARGE, ErrorCode.FILE_TOO_LARGE.getDefaultMessage());
  }

  // 예상치 못한 오류는 로그만 남기고 내부 정보는 숨김
  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
    log.error("처리되지 않은 예외", e);
    return build(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.getDefaultMessage());
  }

  private ResponseEntity<ApiResponse<Void>> build(ErrorCode code, String message) {
    return ResponseEntity.status(code.getStatus()).body(ApiResponse.fail(code, message));
  }
}
