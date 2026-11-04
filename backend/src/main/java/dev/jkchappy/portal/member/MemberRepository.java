package dev.jkchappy.portal.member;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, Long> {

  List<Member> findByActiveTrueOrderByNameAsc();

  List<Member> findAllByOrderByNameAsc();
}
