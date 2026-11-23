package dev.jkchappy.portal.monitor;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
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
  private ServerMonitorService serverMonitorService;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }

  @Test
  void server_returnsServerStatus() throws Exception {
    when(serverMonitorService.status()).thenReturn(new ServerStatusResponse(true, "포털 서버", "Rocky Linux 8.10 (Green Obsidian)", "4.18.0", 12.5, 4,
      7_000L, 16_000L, 86_400L, List.of(new ServerStatusResponse.Disk("시스템", 44L, 100L)),
      OffsetDateTime.of(2026, 11, 23, 15, 0, 0, 0, ZoneOffset.ofHours(9))));

    mockMvc.perform(get("/api/monitor/server"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(jsonPath("$.data.available").value(true))
      .andExpect(jsonPath("$.data.serverName").value("포털 서버"))
      .andExpect(jsonPath("$.data.osName").value("Rocky Linux 8.10 (Green Obsidian)"))
      .andExpect(jsonPath("$.data.kernel").value("4.18.0"))
      .andExpect(jsonPath("$.data.cpuPercent").value(12.5))
      .andExpect(jsonPath("$.data.memoryUsedBytes").value(7000))
      .andExpect(jsonPath("$.data.uptimeSeconds").value(86400))
      .andExpect(jsonPath("$.data.disks[0].name").value("시스템"))
      .andExpect(jsonPath("$.data.disks[0].totalBytes").value(100));
  }
}
