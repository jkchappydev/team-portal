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

  private ExternalContact save(String name, int sortOrder, String project) {
    return contactRepository.save(ExternalContact.create(
      new ContactValues(name, "가나출판", null, "010-1234-5678", "02-123-4567", project, "오전 통화", "#2f9e44"), sortOrder, 1L));
  }

  // 표시 순서대로 조회하고 전화번호 2·연관 프로젝트·메모도 그대로 다시 읽힘
  @Test
  void findAll_ordersBySortOrderAndKeepsValues() {
    save("나중", 1, null);
    ExternalContact first = save("먼저", 0, "전자책, 교과서 개발");
    entityManager.flush();
    entityManager.clear();

    List<ExternalContact> contacts = contactRepository.findAllByOrderBySortOrderAscIdAsc();

    assertThat(contacts).extracting(ExternalContact::getName).containsExactly("먼저", "나중");
    assertThat(contacts.getFirst().getId()).isEqualTo(first.getId());
    assertThat(contacts.getFirst().getProject()).isEqualTo("전자책, 교과서 개발");
    assertThat(contacts.getFirst().getPhone2()).isEqualTo("02-123-4567");
    assertThat(contacts.getFirst().getMemo()).isEqualTo("오전 통화");
    assertThat(contacts.getFirst().getColor()).isEqualTo("#2f9e44");
  }
}
