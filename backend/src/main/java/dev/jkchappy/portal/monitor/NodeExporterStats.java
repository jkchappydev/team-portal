package dev.jkchappy.portal.monitor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 다른 서버 node_exporter의 /metrics(Prometheus 텍스트 형식)에서 모니터링에 쓰는 값만 뽑음
record NodeExporterStats(ProcStats.CpuTimes cpu, int cpuCores, Long memoryTotalBytes, Long memoryAvailableBytes,
  Long uptimeSeconds, String osName, String kernel, List<Filesystem> filesystems) {

  record Filesystem(String mountpoint, long sizeBytes, long availableBytes) {
  }

  // 디스크로 보여 줄 파일 시스템 종류 (스냅 패키지 squashfs·tmpfs 등은 제외)
  private static final Set<String> DISK_TYPES = Set.of("xfs", "ext4", "ext3", "btrfs");
  private static final Pattern LABEL = Pattern.compile("(\\w+)=\"((?:[^\"\\\\]|\\\\.)*)\"");

  record Sample(String name, Map<String, String> labels, double value) {
  }

  // "이름{라벨="값",...} 값" 줄들을 읽음 (# 주석·빈 줄 무시, 형식이 이상한 줄은 건너뜀)
  static List<Sample> parse(String text) {
    List<Sample> samples = new ArrayList<>();
    for (String raw : text.split("\n")) {
      String line = raw.trim();
      if (line.isEmpty() || line.startsWith("#")) {
        continue;
      }
      int brace = line.indexOf('{');
      int space;
      String name;
      Map<String, String> labels = new HashMap<>();
      if (brace >= 0) {
        int close = line.lastIndexOf('}');
        if (close < brace) {
          continue;
        }
        name = line.substring(0, brace);
        Matcher matcher = LABEL.matcher(line.substring(brace + 1, close));
        while (matcher.find()) {
          labels.put(matcher.group(1), matcher.group(2).replace("\\\"", "\"").replace("\\\\", "\\"));
        }
        space = close + 1;
      } else {
        space = line.indexOf(' ');
        if (space < 0) {
          continue;
        }
        name = line.substring(0, space);
      }
      String[] rest = line.substring(space).trim().split("\\s+");
      try {
        samples.add(new Sample(name, labels, Double.parseDouble(rest[0])));
      } catch (NumberFormatException e) {
        // NaN 등 숫자가 아닌 값은 건너뜀
      }
    }
    return samples;
  }

  static NodeExporterStats from(String text) {
    List<Sample> samples = parse(text);
    double cpuTotal = 0;
    double cpuIdle = 0;
    Set<String> cpus = new HashSet<>();
    Long memTotal = null;
    Long memAvailable = null;
    Double boot = null;
    Double now = null;
    String osName = null;
    String kernel = null;
    // 같은 장치가 여러 경로에 붙어 있으면 처음 경로 하나만
    Map<String, Filesystem> byDevice = new LinkedHashMap<>();
    Map<String, Double> sizes = new HashMap<>();
    Map<String, Double> avails = new HashMap<>();
    Map<String, Sample> fsInfo = new LinkedHashMap<>();
    for (Sample s : samples) {
      switch (s.name()) {
        case "node_cpu_seconds_total" -> {
          String mode = s.labels().getOrDefault("mode", "");
          // guest 시간은 user에 이미 들어 있어 node_cpu_guest_seconds_total로 따로 나옴 (여기에는 없음)
          cpuTotal += s.value();
          if (mode.equals("idle") || mode.equals("iowait")) {
            cpuIdle += s.value();
          }
          cpus.add(s.labels().getOrDefault("cpu", ""));
        }
        case "node_memory_MemTotal_bytes" -> memTotal = (long) s.value();
        case "node_memory_MemAvailable_bytes" -> memAvailable = (long) s.value();
        case "node_boot_time_seconds" -> boot = s.value();
        case "node_time_seconds" -> now = s.value();
        case "node_os_info" -> osName = s.labels().get("pretty_name");
        case "node_uname_info" -> kernel = s.labels().get("release");
        case "node_filesystem_size_bytes" -> {
          if (DISK_TYPES.contains(s.labels().getOrDefault("fstype", ""))) {
            String mount = s.labels().getOrDefault("mountpoint", "");
            sizes.put(mount, s.value());
            fsInfo.putIfAbsent(mount, s);
          }
        }
        case "node_filesystem_avail_bytes" -> avails.put(s.labels().getOrDefault("mountpoint", ""), s.value());
        default -> {
          // 쓰지 않는 값
        }
      }
    }
    for (Map.Entry<String, Sample> entry : fsInfo.entrySet()) {
      String mount = entry.getKey();
      // 부팅 영역(/boot)은 사용자가 볼 디스크가 아님
      if (mount.startsWith("/boot") || !avails.containsKey(mount)) {
        continue;
      }
      String device = entry.getValue().labels().getOrDefault("device", mount);
      byDevice.putIfAbsent(device, new Filesystem(mount, sizes.get(mount).longValue(), avails.get(mount).longValue()));
    }
    List<Filesystem> filesystems = byDevice.values().stream()
      .filter(fs -> fs.sizeBytes() > 0)
      .sorted((a, b) -> a.mountpoint().compareTo(b.mountpoint()))
      .toList();
    ProcStats.CpuTimes cpu = cpus.isEmpty() ? null : new ProcStats.CpuTimes(Math.round(cpuTotal * 100), Math.round(cpuIdle * 100));
    Long uptime = boot != null && now != null ? (long) (now - boot) : null;
    return new NodeExporterStats(cpu, cpus.size(), memTotal, memAvailable, uptime, osName, kernel, filesystems);
  }
}
