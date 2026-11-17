package dev.jkchappy.portal.notification;

import dev.jkchappy.portal.member.MemberService;
import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 본문 저장 때 @언급된 팀원 목록을 지금 본문 기준으로 맞춤
@Service
@RequiredArgsConstructor
public class DocumentMentionService {

  private final DocumentMentionRepository mentionRepository;
  private final MemberService memberService;
  private final Clock clock;

  // 새로 언급된 팀원만 언급한 사람·시각을 기록하고, 본문에서 빠진 팀원은 지움
  // memberIds가 null이면(언급 정보를 보내지 않는 협업 서버) 그대로 둠
  @Transactional
  public void sync(Long documentId, List<Long> memberIds, Long mentionedBy) {
    if (memberIds == null) {
      return;
    }
    // 없는 팀원 ID는 무시
    Set<Long> wanted = memberIds.isEmpty() ? Set.of()
      : new HashSet<>(memberService.findNamesByIds(new HashSet<>(memberIds)).keySet());
    Set<Long> existing = new HashSet<>(mentionRepository.findMemberIds(documentId));

    Set<Long> removed = new HashSet<>(existing);
    removed.removeAll(wanted);
    if (!removed.isEmpty()) {
      mentionRepository.delete(documentId, removed);
    }

    // 언급한 사람이 없는 팀원이면 비워 둠 (알림 대상에서 빠짐)
    Long by = mentionedBy != null && memberService.findNamesByIds(Set.of(mentionedBy)).containsKey(mentionedBy)
      ? mentionedBy : null;
    Instant now = clock.instant();
    for (Long memberId : wanted) {
      if (!existing.contains(memberId)) {
        mentionRepository.insert(documentId, memberId, by, now);
      }
    }
  }
}
