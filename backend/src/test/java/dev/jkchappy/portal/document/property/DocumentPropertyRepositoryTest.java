package dev.jkchappy.portal.document.property;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
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
class DocumentPropertyRepositoryTest {

  @Autowired
  private DocumentPropertyRepository propertyRepository;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private EntityManager entityManager;

  // 페이지(프로젝트에 속함)를 하나 만들어 둠
  private Document savedDocument() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    return documentRepository.save(Document.create(space.getId(), "회의록", 1L));
  }

  // 표시 순서대로 조회하고 값·종류가 그대로 다시 읽힘
  @Test
  void findByDocument_ordersBySortOrder() {
    Document doc = savedDocument();
    propertyRepository.save(DocumentProperty.create(doc.getId(), "마감", PropertyType.DATE, "2026-11-30", 1));
    propertyRepository.save(DocumentProperty.create(doc.getId(), "담당자", PropertyType.PERSON, "3,1", 0));
    entityManager.flush();
    entityManager.clear();

    List<DocumentProperty> properties = propertyRepository.findByDocumentIdOrderBySortOrderAscIdAsc(doc.getId());

    assertThat(properties).extracting(DocumentProperty::getName).containsExactly("담당자", "마감");
    assertThat(properties.getFirst().getType()).isEqualTo(PropertyType.PERSON);
    assertThat(properties.getFirst().getValue()).isEqualTo("3,1");
  }

  // 기본 속성 표시는 처음 한 번만 바뀜 (두 번째 요청은 0행)
  @Test
  void markPropertiesInitialized_onlyOnce() {
    Document doc = savedDocument();
    entityManager.flush();

    assertThat(documentRepository.markPropertiesInitialized(doc.getId())).isEqualTo(1);
    assertThat(documentRepository.markPropertiesInitialized(doc.getId())).isEqualTo(0);
    assertThat(documentRepository.findById(doc.getId()).orElseThrow().isPropertiesInitialized()).isTrue();
  }
}
