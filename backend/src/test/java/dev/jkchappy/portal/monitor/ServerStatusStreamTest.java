package dev.jkchappy.portal.monitor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ServerStatusStreamTest {

  private static final OffsetDateTime NOW = OffsetDateTime.of(2026, 11, 24, 10, 0, 0, 0, ZoneOffset.ofHours(9));

  private ServerMonitorService serverMonitorService;
  private RemoteServerMonitor remoteServerMonitor;
  private ServerStatusStream stream;

  @BeforeEach
  void setUp() {
    serverMonitorService = mock(ServerMonitorService.class);
    remoteServerMonitor = mock(RemoteServerMonitor.class);
    when(serverMonitorService.status()).thenReturn(server("포털 서버"));
    when(remoteServerMonitor.statuses()).thenReturn(List.of(server("다른 서버")));
    stream = new ServerStatusStream(serverMonitorService, remoteServerMonitor);
  }

  private static ServerStatusResponse server(String name) {
    return new ServerStatusResponse(true, name, null, null, null, null, null, null, null, List.of(), null, null, NOW);
  }

  @Test
  void snapshot_putsPortalServerFirst() {
    assertThat(stream.snapshot()).extracting(ServerStatusResponse::serverName).containsExactly("포털 서버", "다른 서버");
  }

  @Test
  void subscribe_sendsCurrentStatusRightAway() {
    stream.subscribe();

    assertThat(stream.subscriberCount()).isEqualTo(1);
    verify(serverMonitorService, times(1)).status();
  }

  @Test
  void push_withoutSubscribers_doesNotBuildStatus() {
    stream.push();

    verify(serverMonitorService, never()).status();
    verify(remoteServerMonitor, never()).statuses();
  }

  @Test
  void push_buildsStatusOnceForAllSubscribers() {
    stream.subscribe();
    stream.subscribe();
    stream.subscribe();

    stream.push();

    // 연결 직후 3번 + 주기 전송 1번
    verify(serverMonitorService, times(4)).status();
  }

  @Test
  void push_closedConnection_isRemoved() {
    stream.subscribe().complete();
    stream.subscribe();

    stream.push();

    assertThat(stream.subscriberCount()).isEqualTo(1);
  }
}
