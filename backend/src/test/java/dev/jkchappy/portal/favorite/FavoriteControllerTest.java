package dev.jkchappy.portal.favorite;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.account.Account;
import dev.jkchappy.portal.account.AccountRepository;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.web.client.RestClient;

// 실제 포트로 기동해 내 즐겨찾기 추가·순서 변경·빼기 API 확인
@Import(TestcontainersConfig.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FavoriteControllerTest {

  @LocalServerPort
  private int port;

  @Autowired
  private MemberRepository memberRepository;

  @Autowired
  private AccountRepository accountRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private JdbcIndexedSessionRepository sessions;

  private RestClient client;
  private Long first;
  private Long second;

  @BeforeEach
  void setUp() {
    Member member = memberRepository.save(Member.create("홍길동"));
    String subject = "favorite-test-" + member.getId();
    Account account = Account.createPending(subject, subject + "@example.com", "홍길동", Instant.now());
    account.approve(member, member.getId(), Instant.now());
    accountRepository.save(account);
    Long spaceId = spaceRepository.save(Space.create("개발", null, member.getId())).getId();
    first = documentRepository.save(Document.create(spaceId, "회의록", member.getId())).getId();
    second = documentRepository.save(Document.create(spaceId, "일정", member.getId())).getId();
    client = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + createSession(subject) + "; XSRF-TOKEN=test-csrf")
      .defaultHeader("X-XSRF-TOKEN", "test-csrf")
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { })
      .build();
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private String createSession(String subject) {
    var idToken = OidcIdToken.withTokenValue("test-token").subject(subject)
      .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).build();
    var user = new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_USER")), idToken);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(new OAuth2AuthenticationToken(user, user.getAuthorities(), "google"));
    Session session = sessions.createSession();
    session.setAttribute("SPRING_SECURITY_CONTEXT", context);
    ((SessionRepository) sessions).save(session);
    return Base64.getEncoder().encodeToString(session.getId().getBytes(StandardCharsets.UTF_8));
  }

  @Test
  void addMoveRemove_returnsWholeListInOrder() {
    client.put().uri("/api/me/favorites/{id}", first).retrieve().toEntity(String.class);
    ResponseEntity<String> added = client.put().uri("/api/me/favorites/{id}", second).retrieve().toEntity(String.class);
    assertThat(added.getStatusCode().value()).isEqualTo(200);
    assertThat(added.getBody()).containsSubsequence("회의록", "일정");

    ResponseEntity<String> moved = client.patch().uri("/api/me/favorites/{id}/order", second)
      .contentType(MediaType.APPLICATION_JSON).body(Map.of("index", 0))
      .retrieve().toEntity(String.class);
    assertThat(moved.getBody()).containsSubsequence("일정", "회의록");

    ResponseEntity<String> removed = client.delete().uri("/api/me/favorites/{id}", second)
      .retrieve().toEntity(String.class);
    assertThat(removed.getBody()).contains("회의록").doesNotContain("일정");
    assertThat(client.get().uri("/api/me/favorites").retrieve().body(String.class))
      .contains("\"home\":false").contains("\"kind\":\"PAGE\"");
  }

  @Test
  void add_missingPage_404_badOrder_400() {
    var missing = client.put().uri("/api/me/favorites/{id}", 999_999).retrieve().toEntity(String.class);
    assertThat(missing.getStatusCode().value()).isEqualTo(404);

    var badOrder = client.patch().uri("/api/me/favorites/{id}/order", first)
      .contentType(MediaType.APPLICATION_JSON).body(Map.of("index", -1))
      .retrieve().toEntity(String.class);
    assertThat(badOrder.getStatusCode().value()).isEqualTo(400);
  }
}
