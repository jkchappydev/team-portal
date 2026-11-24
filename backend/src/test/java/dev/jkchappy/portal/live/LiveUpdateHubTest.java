package dev.jkchappy.portal.live;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class LiveUpdateHubTest {

  @Test
  void subscribe_addsSubscriber() {
    LiveUpdateHub hub = new LiveUpdateHub();

    hub.subscribe();
    hub.subscribe();

    assertThat(hub.subscriberCount()).isEqualTo(2);
  }

  @Test
  void onChange_closedConnection_isRemoved() {
    LiveUpdateHub hub = new LiveUpdateHub();
    SseEmitter closed = hub.subscribe();
    hub.subscribe();
    closed.complete();

    hub.onChange(new LiveUpdateEvent(LiveUpdateEvent.WORK_STATUS));

    assertThat(hub.subscriberCount()).isEqualTo(1);
  }

  // 같은 이벤트를 여러 연결에 다시 보내면 줄바꿈이 쌓이므로 연결마다 새 이벤트를 만듦
  @Test
  void broadcast_buildsNewEventForEachConnection() {
    LiveUpdateHub hub = new LiveUpdateHub();
    hub.subscribe();
    hub.subscribe();
    hub.subscribe();
    List<SseEmitter.SseEventBuilder> built = new ArrayList<>();

    hub.broadcast(() -> {
      SseEmitter.SseEventBuilder event = SseEmitter.event().comment("ping");
      built.add(event);
      return event;
    });

    assertThat(built).hasSize(3).doesNotHaveDuplicates();
  }

  @Test
  void heartbeat_closedConnection_isRemoved() {
    LiveUpdateHub hub = new LiveUpdateHub();
    hub.subscribe().complete();

    hub.heartbeat();

    assertThat(hub.subscriberCount()).isZero();
  }
}
