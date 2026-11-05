package dev.jkchappy.portal.auth;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.account.dto.GoogleProfile;
import java.util.Locale;
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
    if (!Boolean.TRUE.equals(user.getEmailVerified()) || email == null ||
      !email.toLowerCase(Locale.ROOT).endsWith("@" + properties.allowedEmailDomain().toLowerCase(Locale.ROOT)) ||
      hd == null || properties.allowedHostedDomains().stream().noneMatch(domain -> domain.equalsIgnoreCase(hd))) {
      throw new OAuth2AuthenticationException(new OAuth2Error("domain_not_allowed"));
    }
    String name = user.getFullName();
    accounts.registerLogin(new GoogleProfile(user.getSubject(), email, name == null || name.isBlank() ? email : name));
    return user;
  }
}
