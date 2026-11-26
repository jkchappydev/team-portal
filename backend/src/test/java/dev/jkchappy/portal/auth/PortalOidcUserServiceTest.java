package dev.jkchappy.portal.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import dev.jkchappy.portal.account.AccountService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

class PortalOidcUserServiceTest {
  private final AccountService accounts = mock(AccountService.class);
  private final PortalOidcUserService service = new PortalOidcUserService(accounts,
    new AuthProperties(List.of("example.com", "example.org"), List.of("example.org", "example.com"), List.of("dev@gmail.com")));

  private OidcUser user(String email, boolean verified, String hd) {
    var builder = OidcIdToken.withTokenValue("token").subject("subject")
      .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60))
      .claim("email", email).claim("email_verified", verified).claim("name", "이름");
    if (hd != null) builder.claim("hd", hd);
    return new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_USER")), builder.build());
  }

  @Test
  void rejectsPersonalAndUnverifiedAccounts() {
    assertThatThrownBy(() -> service.verifyAndRegister(user("a@gmail.com", true, null)))
      .isInstanceOf(OAuth2AuthenticationException.class);
    assertThatThrownBy(() -> service.verifyAndRegister(user("a@example.com", false, "example.org")))
      .isInstanceOf(OAuth2AuthenticationException.class);
    assertThatThrownBy(() -> service.verifyAndRegister(user("a@example.com", true, null)))
      .isInstanceOf(OAuth2AuthenticationException.class);
    assertThatThrownBy(() -> service.verifyAndRegister(user("a@other.kr", true, "example.org")))
      .isInstanceOf(OAuth2AuthenticationException.class);
    assertThatThrownBy(() -> service.verifyAndRegister(user("a@notexample.org", true, "example.org")))
      .isInstanceOf(OAuth2AuthenticationException.class);
    verifyNoInteractions(accounts);
  }

  @Test
  void acceptsBothHostedDomains() {
    service.verifyAndRegister(user("a@example.com", true, "example.org"));
    service.verifyAndRegister(user("a@example.com", true, "example.com"));
    verify(accounts, times(2)).registerLogin(any());
  }

  @Test
  void acceptsBothEmailDomains() {
    service.verifyAndRegister(user("a@example.com", true, "example.org"));
    service.verifyAndRegister(user("b@example.org", true, "example.org"));
    verify(accounts, times(2)).registerLogin(any());
  }

  @Test
  void acceptsAllowedEmailWithoutHostedDomain() {
    service.verifyAndRegister(user("dev@gmail.com", true, null));
    service.verifyAndRegister(user("DEV@gmail.com", true, null));
    verify(accounts, times(2)).registerLogin(any());
  }

  @Test
  void rejectsAllowedEmailWhenUnverified() {
    assertThatThrownBy(() -> service.verifyAndRegister(user("dev@gmail.com", false, null)))
      .isInstanceOf(OAuth2AuthenticationException.class);
    verifyNoInteractions(accounts);
  }

  @Test
  void rejectsPersonalAccountsWhenAllowedEmailsIsEmpty() {
    var strict = new PortalOidcUserService(accounts,
      new AuthProperties(List.of("example.com"), List.of("example.com"), null));
    assertThatThrownBy(() -> strict.verifyAndRegister(user("dev@gmail.com", true, null)))
      .isInstanceOf(OAuth2AuthenticationException.class);
    verifyNoInteractions(accounts);
  }
}
