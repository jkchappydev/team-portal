package dev.jkchappy.portal.monitor;

import dev.jkchappy.portal.monitor.dto.ServerStatusResponse;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.lang.management.ManagementFactory;
import java.nio.file.Path;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

// 포털이 돌아가는 서버의 운영체제, CPU·메모리·디스크·가동 시간
// 컨테이너 안의 /proc는 호스트 값을 그대로 보여줌, 디스크는 compose에서 읽기 전용으로 연결한 경로의 파일 시스템
// 운영체제 이름은 컨테이너 것이 아닌 서버 것을 보이려고 서버 os-release 파일을 읽기 전용으로 연결해 읽음
@Slf4j
@Service
public class ServerMonitorService {

  private final Path procPath;
  private final String serverName;
  private final List<DiskTarget> disks;
  private final String osName;
  private final Clock clock;
  // 마지막 CPU 측정값과 그 직전 측정 대비 사용률
  private ProcStats.CpuTimes lastCpu;
  private volatile Double cpuPercent;

  record DiskTarget(String name, String path) {
  }

  public ServerMonitorService(@Value("${app.monitor.proc-path:/proc}") String procPath,
    @Value("${app.monitor.server-name:포털 서버}") String serverName,
    @Value("${app.monitor.disks:}") String disks,
    @Value("${app.monitor.os-release-path:/host/os-release}") String osReleasePath, Clock clock) {
    this.procPath = Path.of(procPath);
    this.serverName = serverName.isBlank() ? "포털 서버" : serverName.trim();
    this.disks = parseDisks(disks);
    this.osName = readOsName(Path.of(osReleasePath));
    this.clock = clock;
  }

  // 서버 os-release의 이름, 연결된 파일이 없으면(개발 PC 등) JVM이 아는 운영체제 이름과 버전
  static String readOsName(Path osRelease) {
    try {
      String pretty = ProcStats.parsePrettyName(Files.readString(osRelease));
      if (pretty != null) {
        return pretty;
      }
    } catch (IOException | RuntimeException e) {
      // 아래 JVM 값 사용
    }
    return (System.getProperty("os.name", "") + " " + System.getProperty("os.version", "")).trim();
  }

  // "이름=경로,이름=경로" 형식, 비어 있으면 루트 하나
  static List<DiskTarget> parseDisks(String value) {
    List<DiskTarget> result = new ArrayList<>();
    for (String item : value.split(",")) {
      String trimmed = item.trim();
      int eq = trimmed.indexOf('=');
      if (eq > 0 && eq < trimmed.length() - 1) {
        result.add(new DiskTarget(trimmed.substring(0, eq).trim(), trimmed.substring(eq + 1).trim()));
      }
    }
    return result.isEmpty() ? List.of(new DiskTarget("디스크", "/")) : List.copyOf(result);
  }

  // CPU 사용률은 순간값이 아니라 두 측정 사이 평균이라 2초마다 측정해 둠 (계기판이 실시간으로 움직이도록)
  @Scheduled(fixedRate = 2_000)
  public synchronized void sampleCpu() {
    try {
      ProcStats.CpuTimes now = ProcStats.parseCpu(read("stat"));
      if (lastCpu != null) {
        cpuPercent = ProcStats.cpuPercent(lastCpu, now);
      }
      lastCpu = now;
    } catch (IOException | RuntimeException e) {
      // 리눅스가 아닌 개발 PC 등 /proc가 없으면 JVM이 주는 운영체제 CPU 사용률 (컨테이너에서는 /proc를 씀)
      lastCpu = null;
      double load = osBean().map(com.sun.management.OperatingSystemMXBean::getCpuLoad).orElse(-1.0);
      cpuPercent = load < 0 ? null : load * 100;
    }
  }

  private static java.util.Optional<com.sun.management.OperatingSystemMXBean> osBean() {
    return ManagementFactory.getOperatingSystemMXBean() instanceof com.sun.management.OperatingSystemMXBean bean
      ? java.util.Optional.of(bean) : java.util.Optional.empty();
  }

  public ServerStatusResponse status() {
    Long memoryUsed = null;
    Long memoryTotal = null;
    Long uptime = null;
    boolean procAvailable = true;
    try {
      ProcStats.Memory memory = ProcStats.parseMemory(read("meminfo"));
      memoryTotal = memory.totalBytes();
      memoryUsed = memory.totalBytes() - memory.availableBytes();
      uptime = ProcStats.parseUptimeSeconds(read("uptime"));
    } catch (IOException | RuntimeException e) {
      // /proc가 없는 개발 PC는 JVM이 주는 운영체제 메모리 (가동 시간은 알 수 없어 비움)
      var bean = osBean();
      if (bean.isPresent() && bean.get().getTotalMemorySize() > 0) {
        memoryTotal = bean.get().getTotalMemorySize();
        memoryUsed = memoryTotal - bean.get().getFreeMemorySize();
      } else {
        procAvailable = false;
      }
    }
    String kernel = null;
    try {
      kernel = read("sys/kernel/osrelease").trim();
    } catch (IOException | RuntimeException e) {
      // 리눅스가 아니면 커널 버전 없음 (운영체제 이름에 버전이 들어 있음)
    }
    List<ServerStatusResponse.Disk> diskStats = disks.stream()
      .map(this::diskStat)
      .filter(d -> d != null)
      .toList();
    return new ServerStatusResponse(procAvailable, serverName, osName, kernel, cpuPercent, Runtime.getRuntime().availableProcessors(),
      memoryUsed, memoryTotal, uptime, diskStats, OffsetDateTime.now(clock));
  }

  private ServerStatusResponse.Disk diskStat(DiskTarget target) {
    File file = new File(target.path());
    long total = file.getTotalSpace();
    // 경로가 없으면 0이 나옴
    if (total <= 0) {
      return null;
    }
    return new ServerStatusResponse.Disk(target.name(), total - file.getUsableSpace(), total);
  }

  private String read(String name) throws IOException {
    return Files.readString(procPath.resolve(name));
  }
}
