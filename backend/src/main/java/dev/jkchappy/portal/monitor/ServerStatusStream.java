package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// 서버 상태 계기판을 보고 있는 화면들에 2초마다 서버 목록을 직접 보냄 (화면마다 따로 조회하지 않게)
@Slf4j
@Component
@RequiredArgsConstructor
public class ServerStatusStream {

  static final String EVENT = "servers";
  // 연결 하나의 최대 유지 시간 (끊기면 브라우저 EventSource가 자동 재연결)
  static final long TIMEOUT_MS = 30 * 60 * 1000L;

  private final ServerMonitorService serverMonitorService;
  private final RemoteServerMonitor remoteServerMonitor;
  private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();

  // 포털 서버를 맨 앞에, 그 뒤로 설정한 다른 운영 서버들의 자원
  public List<ServerStatusResponse> snapshot() {
    List<ServerStatusResponse> result = new ArrayList<>();
    result.add(serverMonitorService.status());
    result.addAll(remoteServerMonitor.statuses());
    return result;
  }

  public SseEmitter subscribe() {
    SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
    emitters.add(emitter);
    emitter.onCompletion(() -> emitters.remove(emitter));
    emitter.onTimeout(() -> {
      emitters.remove(emitter);
      emitter.complete();
    });
    emitter.onError(error -> emitters.remove(emitter));
    // 연결 직후 지금 값을 보내 다음 주기까지 빈 화면이 없게 함
    send(emitter, event(snapshot()));
    return emitter;
  }

  // 포털 서버 측정 주기(2초)에 맞춰 전송, 보는 화면이 없으면 값을 만들지 않음
  @Scheduled(initialDelay = 2_000, fixedRate = 2_000)
  public void push() {
    if (emitters.isEmpty()) {
      return;
    }
    // 값은 한 번만 만들고, 이벤트는 연결마다 새로 만듦 (같은 이벤트를 다시 쓰면 줄바꿈이 쌓임)
    List<ServerStatusResponse> servers = snapshot();
    for (SseEmitter emitter : emitters) {
      send(emitter, event(servers));
    }
  }

  int subscriberCount() {
    return emitters.size();
  }

  private static SseEmitter.SseEventBuilder event(List<ServerStatusResponse> servers) {
    return SseEmitter.event().name(EVENT).data(servers, MediaType.APPLICATION_JSON);
  }

  // 이미 닫힌 연결은 목록에서 빼고 무시
  private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
    try {
      emitter.send(event);
    } catch (IOException | IllegalStateException e) {
      emitters.remove(emitter);
      log.debug("서버 상태 연결 정리: {}", e.getMessage());
    }
  }
}
