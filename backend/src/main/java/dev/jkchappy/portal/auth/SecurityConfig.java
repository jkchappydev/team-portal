package dev.jkchappy.portal.auth;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

@Configuration
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfig {
  private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, PortalOidcUserService users,
    ClientRegistrationRepository registrations, AccountService accounts,
    HandlerExceptionResolver handlerExceptionResolver) throws Exception {
    var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
    resolver.setAuthorizationRequestCustomizer(builder -> builder.additionalParameters(parameters -> parameters.put("hd", "example.org")));
    // 실시간 알림(SSE) 응답을 이어 쓰는 비동기 디스패치는 처음 요청에서 이미 인증을 거침
    http.authorizeHttpRequests(auth -> auth.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
        .requestMatchers("/internal/**", "/oauth2/**", "/login/oauth2/**").permitAll()
        .requestMatchers("/api/**").authenticated().anyRequest().permitAll())
      .csrf(csrf -> csrf.spa().ignoringRequestMatchers("/internal/**"))
      .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, exception) ->
        handlerExceptionResolver.resolveException(request, response, null, new BusinessException(ErrorCode.UNAUTHENTICATED))))
      .oauth2Login(oauth -> oauth.authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(resolver))
        .userInfoEndpoint(info -> info.oidcUserService(users))
        .defaultSuccessUrl("/", true)
        .failureHandler((request, response, exception) -> {
          String errorCode = exception instanceof OAuth2AuthenticationException oauthError
            ? oauthError.getError().getErrorCode() : exception.getClass().getSimpleName();
          log.warn("구글 로그인 실패: {}", errorCode);
          response.sendRedirect("/login?error=" + ("domain_not_allowed".equals(errorCode) ? "domain" : "failed"));
        }))
      .logout(logout -> logout.logoutUrl("/api/auth/logout").logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
      .addFilterAfter(new OncePerRequestFilter() {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
          throws ServletException, IOException {
          var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
          if (request.getRequestURI().startsWith("/api/") && !request.getRequestURI().equals("/api/auth/me")
            && !request.getRequestURI().equals("/api/auth/logout") && authentication != null
            && authentication.getPrincipal() instanceof OidcUser user) {
            try { accounts.requireActiveMemberId(user.getSubject()); }
            catch (BusinessException e) { handlerExceptionResolver.resolveException(request, response, null, e); return; }
          }
          chain.doFilter(request, response);
        }
      }, AnonymousAuthenticationFilter.class);
    return http.build();
  }
}
