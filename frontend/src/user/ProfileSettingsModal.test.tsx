import { MantineProvider, localStorageColorSchemeManager } from "@mantine/core";
import { COLOR_SCHEME_STORAGE_KEY } from "../theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("../api/notificationSettings", () => ({ listNotificationSettings: vi.fn(() => Promise.resolve([])), changeNotificationSetting: vi.fn() }));
vi.mock("../api/spaces", () => ({ listSpaces: vi.fn(() => Promise.resolve([])) }));
vi.mock("../api/members", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/members")>()), ...members }));

const user = {
  id: 3, name: "홍길동", active: true, email: "hong@example.com", profileColor: null, profileImageUrl: null,
};

function renderModal(client = new QueryClient()) {
  client.setQueryData(["auth", "me"], { memberId: 3, memberName: "홍길동", profileColor: null, profileImageUrl: null });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <ProfileSettingsModal user={user} opened onClose={vi.fn()} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return client;
}

describe("ProfileSettingsModal", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("창 제목은 설정이고, 내 정보 탭이 먼저 열리며 프로필 모양 탭에는 저장 버튼이 없다", () => {
    renderModal();
    expect(screen.getByText("설정", { selector: "h2" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "내 정보" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "프로필 모양" }));
    expect(within(screen.getByRole("tabpanel", { name: "프로필 모양" })).queryByRole("button", { name: "저장" })).toBeNull();
  });

  it("가로 탭은 내 정보, 프로필 모양, 알림 순서다", () => {
    renderModal();
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["내 정보", "프로필 모양", "알림"]);
    fireEvent.click(screen.getByRole("tab", { name: "알림" }));
    expect(screen.getByRole("tab", { name: "알림" }).getAttribute("aria-selected")).toBe("true");
  });

  it("화면 테마는 고르면 바로 적용·저장된다", async () => {
    localStorage.clear();
    const client = new QueryClient();
    client.setQueryData(["auth", "me"], { memberId: 3, memberName: "홍길동", profileColor: null, profileImageUrl: null });
    render(
      <MantineProvider defaultColorScheme="light"
        colorSchemeManager={localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY })}>
        <QueryClientProvider client={client}>
          <ProfileSettingsModal user={user} opened onClose={vi.fn()} />
        </QueryClientProvider>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "프로필 모양" }));

    fireEvent.click(screen.getByRole("radio", { name: "다크" }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-mantine-color-scheme")).toBe("dark"));
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    expect(api.changeProfileColor).not.toHaveBeenCalled();
    localStorage.clear();
  });

  it("이름 아래에 내 이메일 주소를 보여 준다", () => {
    renderModal();
    expect(screen.getByText("hong@example.com")).toBeTruthy();
  });

  it("프로필 띠에 직책·부서를 보여 주고, 카메라 버튼은 이미지 고르기 창을 연다", async () => {
    renderModal();
    expect(await screen.findByText("선임 · 개발팀")).toBeTruthy();
    const input = screen.getByTestId("profile-image-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "프로필 이미지 바꾸기" }));
    expect(click).toHaveBeenCalled();
  });

  it("색을 고르면 바로 저장해 로그인 정보에 반영하고, 저장했습니다 문구는 띄우지 않는다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#1971c2", profileImageUrl: null });
    const client = renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "프로필 모양" }));

    fireEvent.click(screen.getByRole("button", { name: "색 #1971c2" }));

    await waitFor(() => expect(client.getQueryData(["auth", "me"])).toMatchObject({ profileColor: "#1971c2" }));
    expect(api.changeProfileColor.mock.calls[0][0]).toBe("#1971c2");
    expect(screen.queryByText("저장했습니다.")).toBeNull();
  });

  it("자동을 누르면 지금과 다른 색 하나를 골라 바로 저장한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#e03131", profileImageUrl: null });
    renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "프로필 모양" }));

    fireEvent.click(screen.getByRole("button", { name: "자동" }));

    await waitFor(() => expect(api.changeProfileColor).toHaveBeenCalled());
    expect(PROFILE_COLORS).toContain(api.changeProfileColor.mock.calls[0][0]);
  });

  it("randomColor는 지금 색을 고르지 않는다", () => {
    expect(randomColor("#e03131", () => 0)).toBe("#c2255c");
    expect(randomColor("#495057", () => 0.9999)).toBe("#e8590c");
  });

  it("이미지를 고르면 바로 올리고, 2MB를 넘으면 올리지 않고 안내한다", async () => {
    api.uploadProfileImage.mockResolvedValue({ profileColor: null, profileImageUrl: "/api/members/3/profile-image?v=1" });
    const client = renderModal();
    const input = screen.getByTestId("profile-image-input");

    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("프로필 이미지는 2MB까지 올릴 수 있습니다.")).toBeTruthy();
    expect(api.uploadProfileImage).not.toHaveBeenCalled();

    const small = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [small] } });
    await waitFor(() => expect(client.getQueryData(["auth", "me"]))
      .toMatchObject({ profileImageUrl: "/api/members/3/profile-image?v=1" }));
    expect(api.uploadProfileImage).toHaveBeenCalledWith(small);
  });

  it("내 정보에서 부서·직책·연락처를 고쳐 저장한다 (이름은 보여주기만)", async () => {
    renderModal();
    const phone = await screen.findByLabelText(/^전화번호/);
    expect((phone as HTMLInputElement).value).toBe("010-1111-2222");
    expect((screen.getAllByLabelText("이름")[0] as HTMLInputElement).readOnly).toBe(true);

    fireEvent.change(phone, { target: { value: "01099998888" } });
    fireEvent.click(within(screen.getByRole("tabpanel", { name: "내 정보" })).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(members.updateMember).toHaveBeenCalledWith(3, {
      department: "개발팀", jobRank: "SENIOR", phone: "010-9999-8888", extension: "12",
    }));
    expect(await screen.findByText("저장했습니다.")).toBeTruthy();
  });

  it("이미지 파일을 프로필 이미지 칸에 끌어다 놓으면 바로 올리고, 이미지가 아니면 안내한다", async () => {
    api.uploadProfileImage.mockResolvedValue({ profileColor: null, profileImageUrl: "/api/members/3/profile-image?v=2" });
    renderModal();
    const zone = screen.getByLabelText("프로필 이미지 놓는 곳");
    const transfer = (files: File[]) => ({ types: ["Files"], files, getData: () => "", dropEffect: "none" });

    fireEvent.drop(zone, { dataTransfer: transfer([new File(["x"], "memo.txt", { type: "text/plain" })]) });
    expect(await screen.findByText("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.")).toBeTruthy();
    expect(api.uploadProfileImage).not.toHaveBeenCalled();

    const photo = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.dragOver(zone, { dataTransfer: transfer([photo]) });
    expect(await screen.findByText("여기에 놓으면 바로 올라갑니다.")).toBeTruthy();
    fireEvent.drop(zone, { dataTransfer: transfer([photo]) });
    await waitFor(() => expect(api.uploadProfileImage).toHaveBeenCalledWith(photo));
  });
});
