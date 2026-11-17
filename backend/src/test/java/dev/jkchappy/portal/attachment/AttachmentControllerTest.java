package dev.jkchappy.portal.attachment;

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
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;

// 실제 포트로 기동해 Tomcat/멀티파트 한도 동작까지 확인
@Import(TestcontainersConfig.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AttachmentControllerTest {

  private static final Path STORAGE = createStorageDir();

  private static Path createStorageDir() {
    try {
      return Files.createTempDirectory("attachment-test");
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("app.storage.path", STORAGE::toString);
    registry.add("spring.servlet.multipart.max-file-size", () -> "1KB");
    registry.add("spring.servlet.multipart.max-request-size", () -> "1KB");
  }

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
  private String subject;
  private RestClient client;

  @BeforeEach
  @SuppressWarnings({"rawtypes", "unchecked"})
  void setUp() {
    Member member = memberRepository.save(Member.create("홍길동"));
    subject = "attachment-test-" + member.getId();
    Account account = Account.createPending(subject, subject + "@example.com", "홍길동", Instant.now());
    account.approve(member, member.getId(), Instant.now());
    accountRepository.save(account);
    Space space = spaceRepository.save(Space.create("개발", null, member.getId()));
    Document doc = documentRepository.save(Document.create(space.getId(), "문서", member.getId()));
    documentId = doc.getId();
    String sessionCookie = createSession(subject);
    client = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + sessionCookie + "; XSRF-TOKEN=test-csrf")
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

  private RestClient sessionClient(String subject) {
    return RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + createSession(subject) + "; XSRF-TOKEN=test-csrf")
      .defaultHeader("X-XSRF-TOKEN", "test-csrf")
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { }).build();
  }

  @Test
  void pendingAccountCannotAccessFilesOrTickets() {
    String subject = "pending-" + documentId;
    accountRepository.save(Account.createPending(subject, subject + "@example.com", "대기", Instant.now()));
    RestClient pending = sessionClient(subject);
    var download = pending.get().uri("/api/attachments/1/download").retrieve().toEntity(String.class);
    var ticket = pending.post().uri("/api/collab/tickets").retrieve().toEntity(String.class);
    assertThat(download.getStatusCode().value()).isEqualTo(403);
    assertThat(download.getBody()).contains("ACCOUNT_PENDING");
    assertThat(ticket.getStatusCode().value()).isEqualTo(403);
    assertThat(ticket.getBody()).contains("ACCOUNT_PENDING");
  }

  @Test
  void inactiveMemberCannotAccessApi() {
    Member member = memberRepository.save(Member.create("비활성"));
    String subject = "inactive-" + member.getId();
    Account account = Account.createPending(subject, subject + "@example.com", "비활성", Instant.now());
    account.approve(member, member.getId(), Instant.now());
    accountRepository.save(account);
    member.deactivate();
    memberRepository.save(member);
    var response = sessionClient(subject).get().uri("/api/members").retrieve().toEntity(String.class);
    assertThat(response.getStatusCode().value()).isEqualTo(403);
    assertThat(response.getBody()).contains("MEMBER_INACTIVE");
  }

  @Test
  void unauthenticatedRequestReturnsJson401() {
    RestClient anonymous = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { }).build();
    var response = anonymous.get().uri("/api/members").retrieve().toEntity(String.class);
    assertThat(response.getStatusCode().value()).isEqualTo(401);
    assertThat(response.getBody()).contains("UNAUTHENTICATED");
  }

  @Test
  void postWithoutCsrfIsRejected() {
    RestClient noCsrf = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + createSession(subject))
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { }).build();
    var response = noCsrf.post().uri("/api/collab/tickets").retrieve().toEntity(String.class);
    assertThat(response.getStatusCode().value()).isEqualTo(403);
  }

  @Test
  void meProvidesCsrfCookieAfterLogin() {
    RestClient noCsrf = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + createSession(subject))
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { }).build();
    var response = noCsrf.get().uri("/api/auth/me").retrieve().toEntity(String.class);
    assertThat(response.getStatusCode().value()).isEqualTo(200);
    assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).anyMatch(cookie -> cookie.startsWith("XSRF-TOKEN="));
  }

  @Test
  void googleAuthorizationOmitsHostedDomainHint() throws Exception {
    var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/oauth2/authorization/google")).build();
    var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding());
    assertThat(response.statusCode()).isEqualTo(302);
    assertThat(response.headers().firstValue("location")).get().asString().startsWith("https://accounts.google.com").doesNotContain("hd=");
  }

  private ResponseEntity<String> upload(String fileName, byte[] bytes) {
    return upload(fileName, bytes, null, false);
  }

  private ResponseEntity<String> upload(String fileName, byte[] bytes, String partContentType,
    boolean inline) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    ByteArrayResource resource = new ByteArrayResource(bytes) {
      @Override
      public String getFilename() {
        return fileName;
      }
    };
    HttpHeaders partHeaders = new HttpHeaders();
    if (partContentType != null) {
      partHeaders.set(HttpHeaders.CONTENT_TYPE, partContentType);
    }
    body.add("file", new HttpEntity<>(resource, partHeaders));
    return client.post().uri("/api/documents/{id}/attachments?inline={inline}", documentId, inline)
      .contentType(MediaType.MULTIPART_FORM_DATA)
      .body(body)
      .retrieve().toEntity(String.class);
  }

  @Test
  void download_keepsKoreanFileName() {
    ResponseEntity<String> uploaded = upload("기술정리 v2.pdf", "pdf-bytes".getBytes());
    assertThat(uploaded.getStatusCode().value()).isEqualTo(200);
    String body = uploaded.getBody();
    assertThat(body).contains("기술정리 v2.pdf");
    String id = body.replaceAll("(?s).*\"id\":(\\d+).*", "$1");

    ResponseEntity<byte[]> download = client.get().uri("/api/attachments/{id}/download", id)
      .retrieve().toEntity(byte[].class);

    assertThat(download.getStatusCode().value()).isEqualTo(200);
    assertThat(download.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
      .contains("filename*=UTF-8''%EA%B8%B0");
    assertThat(new String(download.getBody())).isEqualTo("pdf-bytes");
  }

  // 본문 표시용 이미지는 inline, 다운로드 버튼(download=true)은 원래 파일 이름으로 바로 저장되게 attachment
  @Test
  void download_image_inlineByDefault_attachmentWhenDownloadRequested() {
    ResponseEntity<String> uploaded = upload("화면.png", "png".getBytes(), "image/png", true);
    String id = uploaded.getBody().replaceAll("(?s).*\"id\":(\\d+).*", "$1");

    String shown = client.get().uri("/api/attachments/{id}/download", id)
      .retrieve().toEntity(byte[].class).getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);
    String saved = client.get().uri("/api/attachments/{id}/download?download=true", id)
      .retrieve().toEntity(byte[].class).getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);

    assertThat(shown).startsWith("inline");
    assertThat(saved).startsWith("attachment").contains("filename*=UTF-8''%ED%99%94%EB%A9%B4.png");
  }

  @Test
  void download_invalidContentType_fallsBackToOctetStream() {
    // RestClient가 잘못된 파트 타입을 거부하므로 멀티파트 본문을 직접 구성
    String raw = "--b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.bin\"\r\n"
      + "Content-Type: foo\r\n\r\nx\r\n--b--\r\n";
    ResponseEntity<String> uploaded = client.post()
      .uri("/api/documents/{id}/attachments", documentId)
      .header(HttpHeaders.CONTENT_TYPE, "multipart/form-data; boundary=b")
      .body(raw)
      .retrieve().toEntity(String.class);
    assertThat(uploaded.getStatusCode().value()).isEqualTo(200);
    assertThat(uploaded.getBody()).contains("\"contentType\":\"application/octet-stream\"");
    String id = uploaded.getBody().replaceAll("(?s).*\"id\":(\\d+).*", "$1");

    ResponseEntity<byte[]> download = client.get().uri("/api/attachments/{id}/download", id)
      .retrieve().toEntity(byte[].class);

    assertThat(download.getStatusCode().value()).isEqualTo(200);
    assertThat(download.getHeaders().getContentType().toString())
      .isEqualTo("application/octet-stream");
  }

  @Test
  void list_excludesInlineUploads() {
    upload("normal.txt", "a".getBytes(), "text/plain", false);
    upload("inline.png", "b".getBytes(), "image/png", true);

    ResponseEntity<String> list = client.get()
      .uri("/api/documents/{id}/attachments", documentId)
      .retrieve().toEntity(String.class);

    assertThat(list.getBody()).contains("normal.txt").doesNotContain("inline.png");
  }

  @Test
  void upload_overLimit_returns413() {
    ResponseEntity<String> response = upload("big.bin", new byte[2048]);

    assertThat(response.getStatusCode().value()).isEqualTo(413);
    assertThat(response.getBody()).contains("\"code\":\"FILE_TOO_LARGE\"");
  }
}
