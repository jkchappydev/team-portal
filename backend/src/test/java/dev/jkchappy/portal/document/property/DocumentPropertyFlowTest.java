package dev.jkchappy.portal.document.property;

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

// 실제 서버·DB를 거치는 페이지 속성 흐름 (처음 목록 → 추가 → 삭제 → 다시 목록)
@Import(TestcontainersConfig.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DocumentPropertyFlowTest {

  @LocalServerPort
  private int port;

  @Autowired
  private MemberRepository memberRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private AccountRepository accountRepository;

  @Autowired
  private JdbcIndexedSessionRepository sessions;

  private Long documentId;
  private RestClient client;

  @BeforeEach
  @SuppressWarnings({"rawtypes", "unchecked"})
  void setUp() {
    Member member = memberRepository.save(Member.create("홍길동"));
    String subject = "property-test-" + member.getId();
    Account account = Account.createPending(subject, subject + "@example.com", "홍길동", Instant.now());
    account.approve(member, member.getId(), Instant.now());
    accountRepository.save(account);
    Space space = spaceRepository.save(Space.create("개발", null, member.getId()));
    documentId = documentRepository.save(Document.create(space.getId(), "문서", member.getId())).getId();

    var idToken = OidcIdToken.withTokenValue("test-token").subject(subject)
      .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).build();
    var user = new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_USER")), idToken);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(new OAuth2AuthenticationToken(user, user.getAuthorities(), "google"));
    Session session = sessions.createSession();
    session.setAttribute("SPRING_SECURITY_CONTEXT", context);
    ((SessionRepository) sessions).save(session);
    String cookie = Base64.getEncoder().encodeToString(session.getId().getBytes(StandardCharsets.UTF_8));
    client = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + cookie + "; XSRF-TOKEN=test-csrf")
      .defaultHeader("X-XSRF-TOKEN", "test-csrf")
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { })
      .build();
  }

  private ResponseEntity<String> list() {
    return client.get().uri("/api/documents/{id}/properties", documentId).retrieve().toEntity(String.class);
  }

  // 기본 담당자와 추가한 속성 모두 지울 수 있고, 지운 담당자는 다시 생기지 않음
  @Test
  void createThenDelete_removesProperty() {
    ResponseEntity<String> first = list();
    assertThat(first.getStatusCode().value()).isEqualTo(200);
    assertThat(first.getBody()).contains("담당자");
    Long assigneeId = Long.valueOf(first.getBody().replaceAll(".*\"id\":(\\d+).*", "$1"));

    ResponseEntity<String> created = client.post().uri("/api/documents/{id}/properties", documentId)
      .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"상태\",\"type\":\"TEXT\"}")
      .retrieve().toEntity(String.class);
    assertThat(created.getStatusCode().value()).isEqualTo(200);
    Long createdId = Long.valueOf(created.getBody().replaceAll(".*\"id\":(\\d+).*", "$1"));

    ResponseEntity<String> deleteCreated = client.delete()
      .uri("/api/documents/{id}/properties/{pid}", documentId, createdId).retrieve().toEntity(String.class);
    ResponseEntity<String> deleteAssignee = client.delete()
      .uri("/api/documents/{id}/properties/{pid}", documentId, assigneeId).retrieve().toEntity(String.class);

    assertThat(deleteCreated.getStatusCode().value()).as(deleteCreated.getBody()).isEqualTo(200);
    assertThat(deleteAssignee.getStatusCode().value()).as(deleteAssignee.getBody()).isEqualTo(200);
    assertThat(list().getBody()).doesNotContain("상태").doesNotContain("담당자");
  }
}
