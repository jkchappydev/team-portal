package dev.jkchappy.portal.account;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.collab.CollabTicketService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class CollabTicketServiceTest {
  @Test
  void ticketCanBeConsumedOnlyOnce() {
    CollabTicketService service = new CollabTicketService(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
    String ticket = service.issue(3L);
    assertThat(ticket).hasSize(43);
    assertThat(service.consume(ticket)).contains(3L);
    assertThat(service.consume(ticket)).isEmpty();
  }

  @Test
  void expiredTicketCannotBeConsumed() {
    class MutableClock extends Clock {
      Instant now = Instant.EPOCH;
      public ZoneId getZone() { return ZoneOffset.UTC; }
      public Clock withZone(ZoneId zone) { return this; }
      public Instant instant() { return now; }
    }
    MutableClock clock = new MutableClock();
    CollabTicketService service = new CollabTicketService(clock);
    String ticket = service.issue(3L);
    clock.now = Instant.EPOCH.plusSeconds(60);
    assertThat(service.consume(ticket)).isEmpty();
  }
}
