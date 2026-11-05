package dev.jkchappy.portal.live;

import static org.assertj.core.api.Assertions.assertThat;

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

  @Test
  void heartbeat_closedConnection_isRemoved() {
    LiveUpdateHub hub = new LiveUpdateHub();
    hub.subscribe().complete();

    hub.heartbeat();

    assertThat(hub.subscriberCount()).isZero();
  }
}
