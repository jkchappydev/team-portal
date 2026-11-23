package dev.jkchappy.portal.monitor;

import java.util.Arrays;

// /proc 파일 내용 해석 (리눅스 커널 형식)
final class ProcStats {

  private ProcStats() {
  }

  // /proc/stat 첫 줄의 CPU 누적 시간 (전체, 쉬는 시간)
  record CpuTimes(long total, long idle) {
  }

  // "cpu  user nice system idle iowait irq softirq steal ..." 에서 앞 8개만 합산 (guest는 user에 이미 포함)
  static CpuTimes parseCpu(String stat) {
    String first = stat.lines().findFirst().orElse("");
    if (!first.startsWith("cpu ")) {
      throw new IllegalArgumentException("cpu 줄이 없습니다.");
    }
    long[] values = Arrays.stream(first.substring(4).trim().split("\\s+")).limit(8).mapToLong(Long::parseLong).toArray();
    if (values.length < 5) {
      throw new IllegalArgumentException("cpu 값이 부족합니다.");
    }
    long total = Arrays.stream(values).sum();
    // 디스크 대기(iowait)도 CPU가 노는 시간으로 봄
    long idle = values[3] + values[4];
    return new CpuTimes(total, idle);
  }

  // 두 측정 사이의 CPU 사용률(0~100), 시간이 흐르지 않았으면 null
  static Double cpuPercent(CpuTimes before, CpuTimes after) {
    long total = after.total() - before.total();
    long idle = after.idle() - before.idle();
    if (total <= 0) {
      return null;
    }
    double percent = (total - idle) * 100.0 / total;
    return Math.max(0, Math.min(100, percent));
  }

  // /proc/meminfo의 전체·사용 가능 메모리 (바이트)
  record Memory(long totalBytes, long availableBytes) {
  }

  static Memory parseMemory(String meminfo) {
    long total = -1;
    long available = -1;
    for (String line : meminfo.split("\n")) {
      if (line.startsWith("MemTotal:")) {
        total = kiloBytes(line);
      } else if (line.startsWith("MemAvailable:")) {
        available = kiloBytes(line);
      }
    }
    if (total < 0 || available < 0) {
      throw new IllegalArgumentException("메모리 값이 없습니다.");
    }
    return new Memory(total, available);
  }

  private static long kiloBytes(String line) {
    String[] parts = line.trim().split("\\s+");
    return Long.parseLong(parts[1]) * 1024;
  }

  // os-release 파일의 PRETTY_NAME (예: Rocky Linux 8.10 (Green Obsidian)), 없으면 null
  static String parsePrettyName(String osRelease) {
    for (String line : osRelease.split("\n")) {
      if (line.startsWith("PRETTY_NAME=")) {
        String value = line.substring("PRETTY_NAME=".length()).trim();
        if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length() - 1);
        }
        return value.isBlank() ? null : value;
      }
    }
    return null;
  }

  // /proc/uptime 첫 값 (부팅 후 초)
  static long parseUptimeSeconds(String uptime) {
    return (long) Double.parseDouble(uptime.trim().split("\\s+")[0]);
  }
}
