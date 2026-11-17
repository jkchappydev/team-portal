package dev.jkchappy.portal.notification;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

// document_mention 복합 키 (페이지 ID + 언급된 팀원 ID)
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class DocumentMentionKey implements Serializable {

  private Long documentId;
  private Long memberId;
}
