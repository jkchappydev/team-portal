package dev.jkchappy.portal.live;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// 열려 있는 화면들에 데이터 변경을 실시간(SSE)으로 알림
@Slf4j
@Component
public class LiveUpdateHub {

  // 연결 하나의 최대 유지 시간 (끊기면 브라우저 EventSource가 자동 재연결)
  static final long TIMEOUT_MS = 30 * 60 * 1000L;

  private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();

  public SseEmitter subscribe() {
    SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
    emitters.add(emitter);
    emitter.onCompletion(() -> emitters.remove(emitter));
    emitter.onTimeout(() -> {
      emitters.remove(emitter);
      emitter.complete();
    });
    emitter.onError(error -> emitters.remove(emitter));
    // 연결 직후 한 번 보내 프록시가 응답 헤더를 바로 넘기게 함
    send(emitter, SseEmitter.event().comment("connected"));
    return emitter;
  }

  // 저장이 확정된 뒤에만 알려 다른 화면이 옛 데이터를 다시 읽지 않게 함
  @TransactionalEventListener(fallbackExecution = true)
  public void onChange(LiveUpdateEvent event) {
    broadcast(() -> SseEmitter.event().name(event.topic()).data(event.topic()));
  }

  // 프록시 유휴 시간 초과(기본 60초)로 끊기지 않도록 주기적으로 빈 신호 전송
  @Scheduled(fixedRate = 25_000)
  public void heartbeat() {
    broadcast(() -> SseEmitter.event().comment("ping"));
  }

  int subscriberCount() {
    return emitters.size();
  }

  // 이벤트는 연결마다 새로 만듦 (같은 이벤트를 다시 보내면 끝 줄바꿈이 보낼 때마다 쌓임)
  void broadcast(Supplier<SseEmitter.SseEventBuilder> event) {
    for (SseEmitter emitter : emitters) {
      send(emitter, event.get());
    }
  }

  // 이미 닫힌 연결은 목록에서 빼고 무시
  private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
    try {
      emitter.send(event);
    } catch (IOException | IllegalStateException e) {
      emitters.remove(emitter);
      log.debug("실시간 알림 연결 정리: {}", e.getMessage());
    }
  }
}
