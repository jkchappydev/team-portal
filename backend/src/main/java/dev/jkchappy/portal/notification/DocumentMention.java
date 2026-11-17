package dev.jkchappy.portal.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 본문에서 @로 언급된 팀원 (언급한 사람과 처음 언급한 시각)
@Entity
@Table(name = "document_mention")
@IdClass(DocumentMentionKey.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentMention {

  @Id
  @Column(name = "document_id")
  private Long documentId;

  @Id
  @Column(name = "member_id")
  private Long memberId;

  @Column(name = "mentioned_by")
  private Long mentionedBy;

  @Column(name = "mentioned_at", nullable = false)
  private Instant mentionedAt;
}
