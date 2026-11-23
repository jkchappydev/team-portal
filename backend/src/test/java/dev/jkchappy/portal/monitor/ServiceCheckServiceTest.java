package dev.jkchappy.portal.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.monitor.dto.ServiceStatusResponse;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.CannotGetJdbcConnectionException;
import org.springframework.jdbc.core.JdbcTemplate;

class ServiceCheckServiceTest {

  private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-23T06:00:00Z"), ZoneId.of("Asia/Seoul"));

  @Test
  void parse_readsGroupNameAndTargetAndSkipsMalformedItems() {
    var targets = MonitorTarget.parse("app|팀 포털|https://team.example.com; db|MySQL|host.docker.internal:3306\n"
      + "app|잘못된 포트|host:abc;cache|구분 오류|host:1;app||host:1;app|이름|");

    assertThat(targets).containsExactly(
      new MonitorTarget(MonitorTarget.Group.APP, "팀 포털", "https://team.example.com"),
      new MonitorTarget(MonitorTarget.Group.DB, "MySQL", "host.docker.internal:3306"));
    assertThat(MonitorTarget.parse("")).isEmpty();
  }

  @Test
  void probe_httpTreatsClientErrorsAsUpAndServerErrorsAsDown() throws IOException {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/login", exchange -> { exchange.sendResponseHeaders(401, -1); exchange.close(); });
    server.createContext("/broken", exchange -> { exchange.sendResponseHeaders(503, -1); exchange.close(); });
    server.start();
    try {
      String base = "http://127.0.0.1:" + server.getAddress().getPort();
      TargetProber prober = new TargetProber();

      ServiceStatusResponse.Check login = prober.probe(new MonitorTarget(MonitorTarget.Group.APP, "로그인", base + "/login"));
      ServiceStatusResponse.Check broken = prober.probe(new MonitorTarget(MonitorTarget.Group.APP, "고장", base + "/broken"));

      assertThat(login.up()).isTrue();
      assertThat(login.statusCode()).isEqualTo(401);
      assertThat(login.responseMs()).isNotNull();
      assertThat(broken.up()).isFalse();
      assertThat(broken.message()).isEqualTo("서버 오류 503");
    } finally {
      server.stop(0);
    }
  }

  @Test
  void probe_tcpReportsWhetherPortAcceptsConnections() throws IOException {
    TargetProber prober = new TargetProber();
    int closedPort;
    try (ServerSocket open = new ServerSocket(0)) {
      ServiceStatusResponse.Check up = prober.probe(
        new MonitorTarget(MonitorTarget.Group.DB, "열린 포트", "127.0.0.1:" + open.getLocalPort()));
      assertThat(up.up()).isTrue();
      assertThat(up.kind()).isEqualTo("TCP");
      closedPort = open.getLocalPort();
    }

    ServiceStatusResponse.Check down = prober.probe(
      new MonitorTarget(MonitorTarget.Group.DB, "닫힌 포트", "127.0.0.1:" + closedPort));

    assertThat(down.up()).isFalse();
    assertThat(down.message()).isEqualTo("연결 안 됨");
  }

  @Test
  void refresh_splitsAppsAndDatabasesInConfiguredOrderAndChecksPortalDatabase() {
    TargetProber prober = mock(TargetProber.class);
    when(prober.probe(any())).thenAnswer(invocation -> {
      MonitorTarget target = invocation.getArgument(0);
      return new ServiceStatusResponse.Check(target.name(), target.target(), "TCP", true, null, 1L, null);
    });
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    when(jdbc.queryForObject("show server_version", String.class)).thenReturn("17.6 (Debian 17.6-1.pgdg13+1)");
    when(jdbc.queryForObject(eq("select count(*) from pg_stat_activity where datname = current_database()"),
      eq(Integer.class))).thenReturn(5);
    when(jdbc.queryForObject("select pg_database_size(current_database())", Long.class)).thenReturn(48_000_000L);
    ServiceCheckService service = new ServiceCheckService(
      "app|가|h:1;db|디비|h:2;app|나|h:3", prober, jdbc, CLOCK);

    assertThat(service.status().checkedAt()).isNull();
    service.refresh();
    ServiceStatusResponse status = service.status();

    assertThat(status.checkedAt()).isNotNull();
    assertThat(status.apps()).extracting(ServiceStatusResponse.Check::name).containsExactly("가", "나");
    assertThat(status.databases()).extracting(ServiceStatusResponse.Check::name).containsExactly("디비");
    assertThat(status.portalDatabase().up()).isTrue();
    assertThat(status.portalDatabase().version()).isEqualTo("PostgreSQL 17.6");
    assertThat(status.portalDatabase().connections()).isEqualTo(5);
    assertThat(status.portalDatabase().sizeBytes()).isEqualTo(48_000_000L);
  }

  @Test
  void checkPortalDatabase_reportsDownWhenQueryFails() {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    when(jdbc.queryForObject("show server_version", String.class))
      .thenThrow(new CannotGetJdbcConnectionException("연결 실패"));
    ServiceCheckService service = new ServiceCheckService("", new TargetProber(), jdbc, CLOCK);

    ServiceStatusResponse.PortalDatabase db = service.checkPortalDatabase();

    assertThat(db.up()).isFalse();
    assertThat(db.message()).isEqualTo("DB에 연결할 수 없습니다.");
  }
}
