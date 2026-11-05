package dev.jkchappy.portal.member;

import java.util.Comparator;
import java.util.List;

public final class MemberOrder {
  private MemberOrder() {}

  public static List<Member> sorted(List<Member> members) {
    return members.stream().sorted(Comparator
      .comparing(Member::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder()))
      .thenComparing(Member::getJobRank, Comparator.nullsLast(Comparator.naturalOrder()))
      .thenComparing(Member::getName)
      .thenComparing(Member::getId, Comparator.nullsLast(Comparator.naturalOrder())))
      .toList();
  }

  public static void placeNew(Member member, List<Member> existing) {
    existing.stream().map(Member::getSortOrder).filter(java.util.Objects::nonNull)
      .max(Long::compareTo).ifPresent(max -> member.changeSortOrder(max + 1));
  }
}
