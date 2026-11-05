package dev.jkchappy.portal.live;

import dev.jkchappy.portal.member.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// 승인된 팀원만 실시간 변경 알림을 구독
@RestController
@RequiredArgsConstructor
public class LiveUpdateController {

  private final LiveUpdateHub hub;

  @GetMapping(value = "/api/live", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter subscribe(@CurrentUser Long userId, HttpServletResponse response) {
    // nginx(포털 내부·운영 앞단 모두)가 알림을 모아 두지 않고 바로 넘기도록 지정
    response.setHeader("X-Accel-Buffering", "no");
    return hub.subscribe();
  }
}
