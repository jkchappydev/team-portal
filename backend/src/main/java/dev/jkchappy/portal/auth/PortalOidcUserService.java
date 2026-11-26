package dev.jkchappy.portal.auth;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.account.dto.GoogleProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PortalOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {
  private final AccountService accounts;
  private final AuthProperties properties;
  private final OidcUserService delegate = new OidcUserService();

  @Override
  public OidcUser loadUser(OidcUserRequest request) throws OAuth2AuthenticationException {
    return verifyAndRegister(delegate.loadUser(request));
  }

  OidcUser verifyAndRegister(OidcUser user) {
    String email = user.getEmail();
    String hd = user.getIdToken().getClaimAsString("hd");
    if (!Boolean.TRUE.equals(user.getEmailVerified()) || !(isExplicitlyAllowed(email) || isCompanyAccount(email, hd))) {
      throw new OAuth2AuthenticationException(new OAuth2Error("domain_not_allowed"));
    }
    String name = user.getFullName();
    accounts.registerLogin(new GoogleProfile(user.getSubject(), email, name == null || name.isBlank() ? email : name));
    return user;
  }

  // 개별 허용 목록에 있는 이메일인지 확인
  private boolean isExplicitlyAllowed(String email) {
    if (email == null) return false;
    return properties.allowedEmails().stream().anyMatch(allowed -> allowed.trim().equalsIgnoreCase(email));
  }

  // 회사 Workspace 계정인지 이메일 도메인과 hd 클레임으로 확인
  private boolean isCompanyAccount(String email, String hd) {
    return isAllowedEmail(email) && hd != null &&
      properties.allowedHostedDomains().stream().anyMatch(domain -> domain.equalsIgnoreCase(hd));
  }

  // 이메일 @ 뒤 도메인이 허용 목록 중 하나와 정확히 일치하는지 확인
  private boolean isAllowedEmail(String email) {
    if (email == null) return false;
    int at = email.lastIndexOf('@');
    if (at < 0) return false;
    String domain = email.substring(at + 1);
    return properties.allowedEmailDomains().stream().anyMatch(allowed -> allowed.trim().equalsIgnoreCase(domain));
  }
}
