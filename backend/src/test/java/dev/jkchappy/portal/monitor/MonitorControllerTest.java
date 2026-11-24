package dev.jkchappy.portal.monitor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.monitor.dto.ServerHistoryResponse;
import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import dev.jkchappy.portal.monitor.dto.ServiceStatusResponse;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@WebMvcTest(MonitorController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class MonitorControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private MemberService memberService;

  @MockitoBean
  private ServerStatusStream serverStatusStream;

  @MockitoBean
  private ServiceCheckService serviceCheckService;

  @MockitoBean
  private MetricHistoryService metricHistoryService;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }

  @Test
  void servers_returnsPortalServerFirstThenRemoteServers() throws Exception {
    when(serverStatusStream.snapshot()).thenReturn(List.of(
      new ServerStatusResponse(true, "포털 서버", "Rocky Linux 8.10 (Green Obsidian)", "4.18.0", 12.5, 4,
        7_000L, 16_000L, 86_400L, List.of(new ServerStatusResponse.Disk("시스템", 44L, 100L)), 2048.0, 1024.0,
        OffsetDateTime.of(2026, 11, 23, 15, 0, 0, 0, ZoneOffset.ofHours(9))),
      new ServerStatusResponse(false, "다른 서버", null, null,
        null, null, null, null, null, List.of(), null, null, OffsetDateTime.of(2026, 11, 23, 15, 0, 0, 0, ZoneOffset.ofHours(9)))));

    mockMvc.perform(get("/api/monitor/servers"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(jsonPath("$.data[0].available").value(true))
      .andExpect(jsonPath("$.data[0].serverName").value("포털 서버"))
      .andExpect(jsonPath("$.data[0].osName").value("Rocky Linux 8.10 (Green Obsidian)"))
      .andExpect(jsonPath("$.data[0].kernel").value("4.18.0"))
      .andExpect(jsonPath("$.data[0].cpuPercent").value(12.5))
      .andExpect(jsonPath("$.data[0].memoryUsedBytes").value(7000))
      .andExpect(jsonPath("$.data[0].uptimeSeconds").value(86400))
      .andExpect(jsonPath("$.data[0].disks[0].name").value("시스템"))
      .andExpect(jsonPath("$.data[0].disks[0].totalBytes").value(100))
      .andExpect(jsonPath("$.data[1].serverName").value("다른 서버"))
      .andExpect(jsonPath("$.data[1].available").value(false));
  }

  @Test
  void serversStream_startsUnbufferedEventStream() throws Exception {
    when(serverStatusStream.subscribe()).thenReturn(new SseEmitter());

    mockMvc.perform(get("/api/monitor/servers/stream"))
      .andExpect(request().asyncStarted())
      .andExpect(header().string("X-Accel-Buffering", "no"));
  }

  @Test
  void services_returnsLatestApplicationAndDatabaseChecks() throws Exception {
    when(serviceCheckService.status()).thenReturn(new ServiceStatusResponse(
      OffsetDateTime.of(2026, 11, 23, 15, 0, 0, 0, ZoneOffset.ofHours(9)),
      new ServiceStatusResponse.PortalDatabase(true, "PostgreSQL 17.6", 3L, 5, 48_000_000L, null),
      List.of(new ServiceStatusResponse.Check(null, "팀 포털", "https://team.example.com", "HTTP", true, 200, 85L, null)),
      List.of(new ServiceStatusResponse.Check("10.0.0.2", "MySQL", "host.docker.internal:3306", "TCP", false, null, null, "연결 안 됨"))));

    mockMvc.perform(get("/api/monitor/services"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.portalDatabase.version").value("PostgreSQL 17.6"))
      .andExpect(jsonPath("$.data.portalDatabase.connections").value(5))
      .andExpect(jsonPath("$.data.apps[0].name").value("팀 포털"))
      .andExpect(jsonPath("$.data.apps[0].statusCode").value(200))
      .andExpect(jsonPath("$.data.databases[0].server").value("10.0.0.2"))
      .andExpect(jsonPath("$.data.databases[0].up").value(false))
      .andExpect(jsonPath("$.data.databases[0].message").value("연결 안 됨"));
  }

  @Test
  void history_returnsBucketedPointsForServerAndRange() throws Exception {
    OffsetDateTime to = OffsetDateTime.of(2026, 11, 24, 10, 0, 0, 0, ZoneOffset.ofHours(9));
    when(metricHistoryService.history("다른 서버", MetricHistoryService.Range.HOUR_6)).thenReturn(new ServerHistoryResponse(
      "다른 서버", "6h", to.minusHours(6), to, 300,
      List.of(new ServerHistoryResponse.Point(to.minusMinutes(5), 3.5, 62.0, 2048.0, 512.0))));

    mockMvc.perform(get("/api/monitor/history").param("server", "다른 서버").param("range", "6h"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.bucketSeconds").value(300))
      .andExpect(jsonPath("$.data.points[0].cpuPercent").value(3.5))
      .andExpect(jsonPath("$.data.points[0].rxBytesPerSec").value(2048.0));
  }

  @Test
  void history_rejectsUnknownRange() throws Exception {
    mockMvc.perform(get("/api/monitor/history").param("server", "다른 서버").param("range", "3d"))
      .andExpect(status().isBadRequest());

    verify(metricHistoryService, never()).history(any(), eq(MetricHistoryService.Range.HOUR_1));
  }
}
