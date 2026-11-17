package dev.jkchappy.portal.document.property;

// 페이지 속성 종류 (값은 모두 글로 저장: 사람은 팀원 id를 쉼표로, 날짜는 YYYY-MM-DD, 체크박스는 true)
public enum PropertyType {
  PERSON,
  TEXT,
  NUMBER,
  DATE,
  CHECKBOX,
  URL
}
