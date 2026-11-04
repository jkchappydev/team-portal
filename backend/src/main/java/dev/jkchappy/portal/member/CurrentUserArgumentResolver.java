package dev.jkchappy.portal.member;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

// X-User-Id 헤더 해석은 이 클래스에서만 수행
@Component
@RequiredArgsConstructor
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

  public static final String HEADER_NAME = "X-User-Id";

  private final MemberService memberService;

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return parameter.hasParameterAnnotation(CurrentUser.class)
      && Long.class.equals(parameter.getParameterType());
  }

  @Override
  public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
    NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
    String header = webRequest.getHeader(HEADER_NAME);
    if (header == null || header.isBlank()) {
      throw new BusinessException(ErrorCode.USER_NOT_SELECTED);
    }
    long userId;
    try {
      userId = Long.parseLong(header.trim());
    } catch (NumberFormatException e) {
      throw new BusinessException(ErrorCode.USER_NOT_SELECTED);
    }
    // 존재하지 않거나 비활성 팀원이면 예외 발생
    memberService.getActiveMember(userId);
    return userId;
  }
}
