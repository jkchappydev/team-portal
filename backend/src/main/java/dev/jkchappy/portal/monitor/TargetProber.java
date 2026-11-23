package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.monitor.dto.ServiceStatusResponse;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

// 확인 대상 하나를 실제로 두드려 봄: 주소는 GET 호출(5xx·응답 없음은 장애), host:port는 연결만
@Component
public class TargetProber {

  static final Duration TIMEOUT = Duration.ofSeconds(5);

  private final HttpClient httpClient = HttpClient.newBuilder()
    .connectTimeout(TIMEOUT)
    .followRedirects(HttpClient.Redirect.NORMAL)
    .build();

  public ServiceStatusResponse.Check probe(MonitorTarget target) {
    return target.isHttp() ? probeHttp(target) : probeTcp(target);
  }

  private ServiceStatusResponse.Check probeHttp(MonitorTarget target) {
    long started = System.nanoTime();
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(target.target())).timeout(TIMEOUT).GET().build();
      int status = httpClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
      long elapsed = elapsedMs(started);
      // 로그인 필요(401·403)나 없는 경로(404)도 서버는 살아 있는 것으로 봄
      boolean up = status < 500;
      return new ServiceStatusResponse.Check(target.name(), target.target(), "HTTP", up, status, elapsed,
        up ? null : "서버 오류 " + status);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return down(target, "HTTP", "확인이 중단되었습니다.");
    } catch (javax.net.ssl.SSLException e) {
      // 인증서가 없거나 도메인과 맞지 않음 (브라우저에서도 경고가 뜸)
      return down(target, "HTTP", "인증서 오류");
    } catch (IOException | RuntimeException e) {
      return down(target, "HTTP", "응답 없음");
    }
  }

  private ServiceStatusResponse.Check probeTcp(MonitorTarget target) {
    int colon = target.target().lastIndexOf(':');
    String host = target.target().substring(0, colon);
    int port = Integer.parseInt(target.target().substring(colon + 1));
    long started = System.nanoTime();
    try (Socket socket = new Socket()) {
      socket.connect(new InetSocketAddress(host, port), (int) TIMEOUT.toMillis());
      return new ServiceStatusResponse.Check(target.name(), target.target(), "TCP", true, null, elapsedMs(started), null);
    } catch (IOException | RuntimeException e) {
      return down(target, "TCP", "연결 안 됨");
    }
  }

  private static ServiceStatusResponse.Check down(MonitorTarget target, String kind, String message) {
    return new ServiceStatusResponse.Check(target.name(), target.target(), kind, false, null, null, message);
  }

  private static long elapsedMs(long started) {
    return Duration.ofNanos(System.nanoTime() - started).toMillis();
  }
}
