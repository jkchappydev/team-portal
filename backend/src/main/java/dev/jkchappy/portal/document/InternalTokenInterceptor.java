package dev.jkchappy.portal.document;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

// /internal/** 요청의 공유 토큰 검증
@Component
public class InternalTokenInterceptor implements HandlerInterceptor {

  public static final String HEADER = "X-Internal-Token";

  private final String internalToken;

  public InternalTokenInterceptor(@Value("${app.internal-token}") String internalToken) {
    this.internalToken = internalToken;
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    String token = request.getHeader(HEADER);
    // 토큰이 없거나 다르면 403 (상수 시간 비교)
    if (token == null || !MessageDigest.isEqual(
      token.getBytes(StandardCharsets.UTF_8), internalToken.getBytes(StandardCharsets.UTF_8))) {
      throw new BusinessException(ErrorCode.FORBIDDEN);
    }
    return true;
  }
}
