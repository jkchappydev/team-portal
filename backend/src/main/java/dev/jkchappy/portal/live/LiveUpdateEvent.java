package dev.jkchappy.portal.live;

// 화면이 다시 불러와야 할 데이터가 바뀌었음을 알리는 이벤트 (topic: 바뀐 데이터 종류)
public record LiveUpdateEvent(String topic) {

  public static final String WORK_STATUS = "work-status";
}
