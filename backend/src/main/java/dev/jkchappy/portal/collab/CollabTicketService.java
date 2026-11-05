package dev.jkchappy.portal.collab;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CollabTicketService {
  private record Ticket(Long memberId, Instant expires) {}
  private final ConcurrentHashMap<String, Ticket> tickets = new ConcurrentHashMap<>();
  private final SecureRandom random = new SecureRandom();
  private final Clock clock;

  public String issue(Long memberId) {
    Instant now = clock.instant();
    tickets.entrySet().removeIf(entry -> !entry.getValue().expires().isAfter(now));
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    tickets.put(token, new Ticket(memberId, now.plusSeconds(60)));
    return token;
  }

  public Optional<Long> consume(String token) {
    Ticket ticket = token == null ? null : tickets.remove(token);
    return ticket != null && ticket.expires().isAfter(clock.instant()) ? Optional.of(ticket.memberId()) : Optional.empty();
  }
}
