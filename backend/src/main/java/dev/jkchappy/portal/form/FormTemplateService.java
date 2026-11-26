package dev.jkchappy.portal.form;

import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.attachment.UploadFiles;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.dto.TrashItem;
import dev.jkchappy.portal.form.dto.FormResponse;
import dev.jkchappy.portal.member.MemberService;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class FormTemplateService {

  private final FormTemplateRepository formRepository;
  private final FileStorage fileStorage;
  private final MemberService memberService;

  public record Download(FormTemplate form, Resource resource) {
  }

  // 표시 순서대로 양식 목록 조회 (휴지통에 있는 파일 제외, 올린 사람 이름 포함)
  @Transactional(readOnly = true)
  public List<FormResponse> findAll() {
    List<FormTemplate> forms = formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc();
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
    int sortOrder = nextSortOrder();
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
    FormTemplate target = getLiveForm(id);
    List<FormTemplate> forms = new ArrayList<>(formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc()
      .stream().filter(f -> !f.getId().equals(id)).toList());
    forms.add(Math.clamp(index, 0, forms.size()), target);
    for (int i = 0; i < forms.size(); i++) {
      forms.get(i).changeSortOrder(i);
    }
  }

  @Transactional(readOnly = true)
  public Download download(Long id) {
    FormTemplate form = getLiveForm(id);
    return new Download(form, fileStorage.load(form.getStoredName()));
  }

  // 휴지통으로 이동 (페이지처럼 휴지통에서 되살리거나 영구 삭제)
  @Transactional
  public void delete(Long id) {
    getLiveForm(id).softDelete();
  }

  // 휴지통에서 되살리면 보관함 목록 맨 아래로
  @Transactional
  public void restore(Long id) {
    FormTemplate form = getForm(id);
    if (!form.isDeleted()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "휴지통에 있는 파일만 되살릴 수 있습니다.");
    }
    form.restore(nextSortOrder());
  }

  // 휴지통 목록에 함께 보일 삭제된 파일 (최근 삭제순)
  @Transactional(readOnly = true)
  public List<TrashItem> findTrash() {
    return formRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc().stream()
      .map(f -> new TrashItem("form", f.getId(), f.getOriginalName(), null, null,
        "공유 보관함", null, null, f.getDeletedAt().atOffset(ZoneOffset.UTC), List.of()))
      .toList();
  }

  // 휴지통에 있는 파일만 행과 파일 본체를 영구 삭제 (파일 본체는 커밋된 뒤 삭제, 실패는 로그만)
  @Transactional
  public void purge(Long id) {
    FormTemplate form = getForm(id);
    if (!form.isDeleted()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "휴지통에 있는 파일만 영구 삭제할 수 있습니다.");
    }
    formRepository.delete(form);
    deleteFileAfterCommit(form.getStoredName());
  }

  private int nextSortOrder() {
    return formRepository.findByDeletedAtIsNullOrderBySortOrderAscIdAsc().stream()
      .mapToInt(FormTemplate::getSortOrder).max().orElse(-1) + 1;
  }

  private FormTemplate getForm(Long id) {
    return formRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  // 휴지통에 있는 파일은 보관함에서 없는 파일로 취급
  private FormTemplate getLiveForm(Long id) {
    FormTemplate form = getForm(id);
    if (form.isDeleted()) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }
    return form;
  }

  private void deleteFileAfterCommit(String storedName) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      deleteFileQuietly(storedName);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCommit() {
        deleteFileQuietly(storedName);
      }
    });
  }

  private void deleteFileQuietly(String storedName) {
    try {
      fileStorage.delete(storedName);
    } catch (RuntimeException e) {
      log.warn("영구 삭제한 공유 보관함 파일 본체를 지우지 못했습니다. storedName={}", storedName, e);
    }
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
