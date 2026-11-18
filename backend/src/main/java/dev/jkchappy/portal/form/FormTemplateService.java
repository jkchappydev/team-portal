package dev.jkchappy.portal.form;

import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.attachment.UploadFiles;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.form.dto.FormResponse;
import dev.jkchappy.portal.member.MemberService;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FormTemplateService {

  private final FormTemplateRepository formRepository;
  private final FileStorage fileStorage;
  private final MemberService memberService;

  public record Download(FormTemplate form, Resource resource) {
  }

  // 표시 순서대로 양식 목록 조회 (올린 사람 이름 포함)
  @Transactional(readOnly = true)
  public List<FormResponse> findAll() {
    List<FormTemplate> forms = formRepository.findAllByOrderBySortOrderAscIdAsc();
    Map<Long, String> names = memberService.findNamesByIds(
      new HashSet<>(forms.stream().map(FormTemplate::getUploadedBy).toList()));
    return forms.stream().map(f -> FormResponse.from(f, names.getOrDefault(f.getUploadedBy(), ""))).toList();
  }

  // 새 양식은 목록 맨 아래, 파일 저장 후 DB 저장 실패·롤백 시 저장된 파일 삭제
  @Transactional
  public FormResponse upload(MultipartFile file, Long userId) {
    if (file == null || file.isEmpty()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "비어 있는 파일은 업로드할 수 없습니다.");
    }
    String storedName;
    try (InputStream in = file.getInputStream()) {
      storedName = fileStorage.save(in);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    registerRollbackCleanup(storedName);
    int sortOrder = formRepository.findAllByOrderBySortOrderAscIdAsc().stream()
      .mapToInt(FormTemplate::getSortOrder).max().orElse(-1) + 1;
    FormTemplate saved;
    try {
      saved = formRepository.save(FormTemplate.create(UploadFiles.sanitizeName(file.getOriginalFilename()),
        storedName, UploadFiles.resolveContentType(file), file.getSize(), sortOrder, userId));
    } catch (RuntimeException e) {
      fileStorage.delete(storedName);
      throw e;
    }
    Map<Long, String> names = memberService.findNamesByIds(Set.of(userId));
    return FormResponse.from(saved, names.getOrDefault(userId, ""));
  }

  // 끌어 옮긴 양식을 index 위치에 끼워 넣고 0부터 다시 번호를 매김
  @Transactional
  public void move(Long id, int index) {
    FormTemplate target = getForm(id);
    List<FormTemplate> forms = new ArrayList<>(formRepository.findAllByOrderBySortOrderAscIdAsc()
      .stream().filter(f -> !f.getId().equals(id)).toList());
    forms.add(Math.clamp(index, 0, forms.size()), target);
    for (int i = 0; i < forms.size(); i++) {
      forms.get(i).changeSortOrder(i);
    }
  }

  @Transactional(readOnly = true)
  public Download download(Long id) {
    FormTemplate form = getForm(id);
    return new Download(form, fileStorage.load(form.getStoredName()));
  }

  // DB 행과 파일을 함께 하드 삭제 (파일 삭제 실패 시 행 삭제도 롤백)
  @Transactional
  public void delete(Long id) {
    FormTemplate form = getForm(id);
    formRepository.delete(form);
    fileStorage.delete(form.getStoredName());
  }

  private FormTemplate getForm(Long id) {
    return formRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  // 트랜잭션이 커밋되지 못하면 이미 저장한 파일 정리
  private void registerRollbackCleanup(String storedName) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCompletion(int status) {
        if (status != STATUS_COMMITTED) {
          fileStorage.delete(storedName);
        }
      }
    });
  }
}
