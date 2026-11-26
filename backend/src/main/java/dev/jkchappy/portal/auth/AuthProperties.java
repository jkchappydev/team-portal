package dev.jkchappy.portal.auth;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.auth")
// allowedEmails: 도메인 검사와 무관하게 로그인을 허용할 개별 이메일 (개인 개발 계정 등)
public record AuthProperties(List<String> allowedEmailDomains, List<String> allowedHostedDomains, List<String> allowedEmails) {
  public AuthProperties {
    allowedEmails = allowedEmails == null ? List.of() : allowedEmails;
  }
}
