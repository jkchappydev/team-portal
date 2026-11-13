package dev.jkchappy.portal.member;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemberRepository extends JpaRepository<Member, Long> {

  List<Member> findByActiveTrueOrderByNameAsc();

  List<Member> findAllByOrderByNameAsc();

  // 삭제하지 않은 팀원 (활성·비활성 모두)
  List<Member> findByDeletedOnIsNullOrderByNameAsc();

  // 해당 연도 연차 표에 나올 팀원: 삭제하지 않았거나 그 해 이후에 삭제한 팀원
  @Query("select m from Member m where m.deletedOn is null or m.deletedOn >= :yearStart order by m.name")
  List<Member> findVisibleInYear(@Param("yearStart") LocalDate yearStart);

  long countByAdminTrueAndActiveTrue();

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select m from Member m where m.id = :id")
  Optional<Member> findForUpdateById(@Param("id") Long id);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select m from Member m where m.admin = true and m.active = true order by m.id")
  List<Member> lockActiveAdmins();

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select m from Member m order by m.id")
  List<Member> lockAllForOrder();

  // 근무 상황 변경 알림을 받는 팀원: 삭제·비활성이 아니고 지정한 직급(팀장 이상)이거나 개발자
  @Query("select m from Member m where m.active = true and m.deletedOn is null "
    + "and (m.developer = true or m.jobRank in :ranks) order by m.id")
  List<Member> findWorkStatusNoticeRecipients(@Param("ranks") Collection<JobRank> ranks);
}
