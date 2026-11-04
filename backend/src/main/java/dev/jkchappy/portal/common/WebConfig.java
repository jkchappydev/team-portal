package dev.jkchappy.portal.common;

import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

  private final CurrentUserArgumentResolver currentUserArgumentResolver;
  private final InternalTokenInterceptor internalTokenInterceptor;

  // 내부 API에만 토큰 검증 적용
  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(internalTokenInterceptor).addPathPatterns("/internal/**");
  }

  @Override
  public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
    resolvers.add(currentUserArgumentResolver);
  }
}
