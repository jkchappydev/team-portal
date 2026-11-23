package dev.jkchappy.portal.monitor;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// 모니터링 상세 화면에서 확인할 애플리케이션·DB 하나
// target이 http(s):// 주소면 호출해 응답을, host:port면 포트 연결만 확인
// server는 어느 운영 서버 것인지 (서버 이름 또는 IP, 없으면 포털 서버)
record MonitorTarget(String server, Group group, String name, String target) {

  enum Group { APP, DB }

  boolean isHttp() {
    return target.startsWith("http://") || target.startsWith("https://");
  }

  // "구분|이름|대상" 또는 "서버|구분|이름|대상" 항목을 줄바꿈 또는 ; 으로 나열 (구분은 app 또는 db), 형식이 맞지 않는 항목은 건너뜀
  static List<MonitorTarget> parse(String value) {
    List<MonitorTarget> result = new ArrayList<>();
    if (value == null) {
      return result;
    }
    for (String item : value.split("[;\\n]")) {
      String[] all = item.trim().split("\\|", -1);
      if (all.length != 3 && all.length != 4) {
        continue;
      }
      String server = all.length == 4 && !all[0].isBlank() ? all[0].trim() : null;
      String[] parts = all.length == 4 ? Arrays.copyOfRange(all, 1, 4) : all;
      Group group = switch (parts[0].trim().toLowerCase()) {
        case "app" -> Group.APP;
        case "db" -> Group.DB;
        default -> null;
      };
      String name = parts[1].trim();
      String target = parts[2].trim();
      if (group != null && !name.isEmpty() && isValidTarget(target)) {
        result.add(new MonitorTarget(server, group, name, target));
      }
    }
    return List.copyOf(result);
  }

  private static boolean isValidTarget(String target) {
    if (target.startsWith("http://") || target.startsWith("https://")) {
      return true;
    }
    int colon = target.lastIndexOf(':');
    if (colon <= 0 || colon == target.length() - 1) {
      return false;
    }
    try {
      int port = Integer.parseInt(target.substring(colon + 1));
      return port > 0 && port <= 65535;
    } catch (NumberFormatException e) {
      return false;
    }
  }
}
