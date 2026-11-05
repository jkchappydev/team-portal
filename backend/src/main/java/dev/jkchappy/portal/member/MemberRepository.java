package dev.jkchappy.portal.member;

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
}
