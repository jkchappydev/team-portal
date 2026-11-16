package dev.jkchappy.portal.contact;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.contact.ExternalContact.ContactValues;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TestcontainersConfig.class)
class ExternalContactRepositoryTest {

  @Autowired
  private ExternalContactRepository contactRepository;

  @Autowired
  private EntityManager entityManager;

  private ExternalContact save(String name, int sortOrder, List<String> projects) {
    return contactRepository.save(ExternalContact.create(
      new ContactValues(name, "가나출판", null, null, null, projects, null), sortOrder, 1L));
  }

  // 표시 순서대로 조회하고 연관 프로젝트는 입력한 순서 그대로 다시 읽힘
  @Test
  void findAll_ordersBySortOrderAndKeepsProjectOrder() {
    save("나중", 1, List.of());
    ExternalContact first = save("먼저", 0, List.of("전자책", "교과서 개발"));
    entityManager.flush();
    entityManager.clear();

    List<ExternalContact> contacts = contactRepository.findAllByOrderBySortOrderAscIdAsc();

    assertThat(contacts).extracting(ExternalContact::getName).containsExactly("먼저", "나중");
    assertThat(contacts.getFirst().getId()).isEqualTo(first.getId());
    assertThat(contacts.getFirst().getProjects()).containsExactly("전자책", "교과서 개발");
  }

  // 연락처를 지우면 연관 프로젝트도 함께 지워짐
  @Test
  void delete_removesProjects() {
    ExternalContact contact = save("홍길동", 0, List.of("전자책"));
    entityManager.flush();
    contactRepository.delete(contact);
    entityManager.flush();

    Number left = (Number) entityManager
      .createNativeQuery("select count(*) from external_contact_project").getSingleResult();
    assertThat(left.longValue()).isZero();
  }
}
