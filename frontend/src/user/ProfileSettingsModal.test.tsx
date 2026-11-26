import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import { COLOR_SCHEME_STORAGE_KEY } from "../theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PROFILE_COLORS } from "../documents/userColor";
import { ProfileSettingsModal, randomColor } from "./ProfileSettingsModal";

const api = vi.hoisted(() => ({
  changeProfileColor: vi.fn(),
  uploadProfileImage: vi.fn(),
  removeProfileImage: vi.fn(),
}));
vi.mock("../api/profile", () => api);
const members = vi.hoisted(() => ({
  listMembers: vi.fn(() => Promise.resolve([{
    id: 3, name: "홍길동", active: true, department: "개발팀", jobRank: "SENIOR", phone: "010-1111-2222", extension: "12",
  }])),
  updateMember: vi.fn(() => Promise.resolve({ id: 3, name: "홍길동", active: true })),
}));
const notifications = vi.hoisted(() => ({
  listNotificationSettings: vi.fn(() => Promise.resolve([])),
  changeNotificationSetting: vi.fn(),
}));
vi.mock("../api/notificationSettings", () => notifications);
vi.mock("../api/spaces", () => ({
  listSpaces: vi.fn(() => Promise.resolve([
    { id: 1, name: "스쿨북스", description: null, documentCount: 1, homeDocumentId: 10, kind: "PROJECT", icon: null, cover: null },
  ])),
}));
vi.mock("../api/members", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/members")>()), ...members }));

const user = {
  id: 3, name: "홍길동", active: true, email: "hong@example.com", profileColor: null, profileImageUrl: null,
};

function renderModal(client = new QueryClient(), wrapTheme = false) {
  client.setQueryData(["auth", "me"], { memberId: 3, memberName: "홍길동", profileColor: null, profileImageUrl: null });
  render(
    <MantineProvider {...(wrapTheme ? {
      defaultColorScheme: "light" as const,
      colorSchemeManager: localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY }),
    } : {})}>
      <QueryClientProvider client={client}>
        <ProfileSettingsModal user={user} opened onClose={vi.fn()} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return client;
}

const saveButton = () => screen.getByRole("button", { name: "저장" }) as HTMLButtonElement;
const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

describe("ProfileSettingsModal", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    // 고른 이미지 미리보기 주소 (jsdom에 없음)
    URL.createObjectURL ??= () => "blob:preview";
    URL.revokeObjectURL ??= () => {};
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("창 제목은 설정이고 내 정보 탭이 먼저 열리며, 탭은 내 정보·개인 설정·알림 순서다", () => {
    renderModal();
    expect(screen.getByText("설정", { selector: "h2" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "내 정보" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["내 정보", "개인 설정", "알림"]);
  });

  it("저장 버튼은 하나이고 어느 탭에서든 보이며, 바꾼 것이 없으면 누를 수 없다", async () => {
    renderModal();
    await screen.findByLabelText(/^전화번호/);
    expect(screen.getAllByRole("button", { name: "저장" })).toHaveLength(1);
    expect(saveButton().disabled).toBe(true);
    openTab("개인 설정");
    expect(saveButton().disabled).toBe(true);
    openTab("알림");
    expect(saveButton().disabled).toBe(true);
  });

  it("이름 아래에 내 이메일과 부서·직책을 보여 준다", async () => {
    renderModal();
    expect(screen.getByText("hong@example.com")).toBeTruthy();
    expect(await screen.findByText("개발팀 · 선임")).toBeTruthy();
  });

  it("내 정보를 고쳐도 저장 전에는 보내지 않고, 저장하면 보내고 저장했습니다를 띄운다", async () => {
    renderModal();
    const phone = await screen.findByLabelText(/^전화번호/);
    expect((screen.getAllByLabelText("이름")[0] as HTMLInputElement).readOnly).toBe(true);

    fireEvent.change(phone, { target: { value: "01099998888" } });
    expect(members.updateMember).not.toHaveBeenCalled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(members.updateMember).toHaveBeenCalledWith(3, {
      department: "개발팀", jobRank: "SENIOR", phone: "010-9999-8888", extension: "12",
    }));
    expect(await screen.findByText("저장했습니다.")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it("내 정보 필수 칸이 비면 저장할 수 없다", async () => {
    renderModal();
    fireEvent.change(await screen.findByLabelText(/^내선번호/), { target: { value: "" } });
    expect(saveButton().disabled).toBe(true);
  });

  it("색은 고르면 미리 보이기만 하고, 저장하면 저장해 로그인 정보에 반영한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#1971c2", profileImageUrl: null });
    const client = renderModal();
    openTab("개인 설정");

    fireEvent.click(screen.getByRole("button", { name: "색 #1971c2" }));
    expect(screen.getByRole("button", { name: "색 #1971c2" }).getAttribute("aria-pressed")).toBe("true");
    expect(api.changeProfileColor).not.toHaveBeenCalled();

    fireEvent.click(saveButton());
    await waitFor(() => expect(client.getQueryData(["auth", "me"])).toMatchObject({ profileColor: "#1971c2" }));
    expect(api.changeProfileColor).toHaveBeenCalledWith("#1971c2");
    expect(await screen.findByText("저장했습니다.")).toBeTruthy();
  });

  it("화면 테마 미리보기는 저장 전에 고른 테마로 바뀐다", () => {
    renderModal(new QueryClient(), true);
    openTab("개인 설정");
    const preview = () => screen.getByLabelText("화면 테마 미리보기");
    expect(preview().getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: "다크" }));
    expect(preview().getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("radio", { name: "시스템" }));
    expect(preview().getAttribute("data-theme")).toBe("auto");
  });

  it("자동을 누르면 지금과 다른 색 하나를 골라 두고, 저장하면 그 색을 저장한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#e03131", profileImageUrl: null });
    renderModal();
    openTab("개인 설정");

    fireEvent.click(screen.getByRole("button", { name: "자동" }));
    expect(api.changeProfileColor).not.toHaveBeenCalled();
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.changeProfileColor).toHaveBeenCalled());
    expect(PROFILE_COLORS).toContain(api.changeProfileColor.mock.calls[0][0]);
  });

  it("randomColor는 지금 색을 고르지 않는다", () => {
    expect(randomColor("#e03131", () => 0)).toBe("#c2255c");
    expect(randomColor("#495057", () => 0.9999)).toBe("#e8590c");
  });

  it("카메라 버튼은 이미지 고르기 창을 연다", () => {
    renderModal();
    const input = screen.getByTestId("profile-image-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "프로필 이미지 바꾸기" }));
    expect(click).toHaveBeenCalled();
  });

  it("이미지는 고르면 미리 보이기만 하고 저장할 때 올리며, 2MB를 넘으면 고르지 않고 안내한다", async () => {
    api.uploadProfileImage.mockResolvedValue({ profileColor: null, profileImageUrl: "/api/members/3/profile-image?v=1" });
    const client = renderModal();
    const input = screen.getByTestId("profile-image-input");

    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("프로필 이미지는 2MB까지 올릴 수 있습니다.")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);

    const small = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [small] } });
    expect(screen.queryByText("프로필 이미지는 2MB까지 올릴 수 있습니다.")).toBeNull();
    expect(api.uploadProfileImage).not.toHaveBeenCalled();

    fireEvent.click(saveButton());
    await waitFor(() => expect(client.getQueryData(["auth", "me"]))
      .toMatchObject({ profileImageUrl: "/api/members/3/profile-image?v=1" }));
    expect(api.uploadProfileImage).toHaveBeenCalledWith(small);
  });

  it("이미지 파일을 프로필 이미지 칸에 끌어다 놓으면 골라 두고, 이미지가 아니면 안내한다", async () => {
    api.uploadProfileImage.mockResolvedValue({ profileColor: null, profileImageUrl: "/api/members/3/profile-image?v=2" });
    renderModal();
    openTab("개인 설정");
    const zone = screen.getByLabelText("프로필 이미지 놓는 곳");
    const transfer = (files: File[]) => ({ types: ["Files"], files, getData: () => "", dropEffect: "none" });

    fireEvent.drop(zone, { dataTransfer: transfer([new File(["x"], "memo.txt", { type: "text/plain" })]) });
    expect(await screen.findByText("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.")).toBeTruthy();

    const photo = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.dragOver(zone, { dataTransfer: transfer([photo]) });
    expect(await screen.findByText("여기에 놓으면 이미지를 바꿉니다.")).toBeTruthy();
    fireEvent.drop(zone, { dataTransfer: transfer([photo]) });
    expect(api.uploadProfileImage).not.toHaveBeenCalled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.uploadProfileImage).toHaveBeenCalledWith(photo));
  });

  it("화면 테마는 골라도 바로 바뀌지 않고, 저장하면 적용된다", async () => {
    renderModal(new QueryClient(), true);
    openTab("개인 설정");

    fireEvent.click(screen.getByRole("radio", { name: "다크" }));
    expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("light");
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).not.toBe("dark");

    fireEvent.click(saveButton());
    await waitFor(() => expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark"));
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    expect(api.changeProfileColor).not.toHaveBeenCalled();
  });

  it("알림은 골라도 바로 저장하지 않고, 저장하면 바꾼 프로젝트만 저장한다", async () => {
    notifications.changeNotificationSetting.mockResolvedValue({ spaceId: 1, level: "OFF" });
    renderModal();
    openTab("알림");

    fireEvent.click(await screen.findByLabelText("스쿨북스 끄기"));
    expect((screen.getByLabelText("스쿨북스 끄기") as HTMLInputElement).checked).toBe(true);
    expect(notifications.changeNotificationSetting).not.toHaveBeenCalled();

    fireEvent.click(saveButton());
    await waitFor(() => expect(notifications.changeNotificationSetting).toHaveBeenCalledWith(1, "OFF"));
    expect(notifications.changeNotificationSetting).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("저장했습니다.")).toBeTruthy();
  });

  it("저장에 실패하면 오류를 보이고 바꾼 내용은 그대로 남긴다", async () => {
    api.changeProfileColor.mockRejectedValue(new Error("실패"));
    renderModal();
    openTab("개인 설정");

    fireEvent.click(screen.getByRole("button", { name: "색 #1971c2" }));
    fireEvent.click(saveButton());

    expect(await screen.findByText("저장하지 못했습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "색 #1971c2" }).getAttribute("aria-pressed")).toBe("true");
    expect(saveButton().disabled).toBe(false);
  });
});
