import { MantineProvider } from "@mantine/core";
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
vi.mock("../api/members", async (importOriginal) => ({ ...(await importOriginal<typeof import("../api/members")>()), ...members }));

const user = {
  id: 3, name: "홍길동", active: true, email: "hong@example.com", profileColor: null, profileImageUrl: null,
};

// 내 설정 탭 안의 저장 버튼 누르기
function saveProfile() {
  fireEvent.click(within(screen.getByRole("tabpanel", { name: "내 설정" })).getByRole("button", { name: "저장" }));
}

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

  it("개인정보 수정 탭이 먼저 열리고, 내 설정 탭은 바뀐 것이 없으면 저장 버튼이 꺼져 있다", () => {
    renderModal();
    expect(screen.getByRole("tab", { name: "개인정보 수정" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "내 설정" }));
    expect((within(screen.getByRole("tabpanel", { name: "내 설정" })).getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("내 설정 탭에서 화면 테마를 고를 수 있다", () => {
    renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "내 설정" }));
    expect(screen.getByText("화면 테마")).toBeTruthy();
    expect(screen.getByLabelText("화면 테마", { selector: "input" })).toBeTruthy();
  });

  it("이름 아래에 내 이메일 주소를 보여 준다", () => {
    renderModal();
    expect(screen.getByText("hong@example.com")).toBeTruthy();
  });

  it("색을 고르면 미리 보기만 바뀌고, 저장을 눌러야 저장해 로그인 정보에 반영한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#1971c2", profileImageUrl: null });
    const client = renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "내 설정" }));

    fireEvent.click(screen.getByRole("button", { name: "색 #1971c2" }));
    expect(api.changeProfileColor).not.toHaveBeenCalled();
    saveProfile();

    await waitFor(() => expect(client.getQueryData(["auth", "me"])).toMatchObject({ profileColor: "#1971c2" }));
    expect(api.changeProfileColor.mock.calls[0][0]).toBe("#1971c2");
  });

  it("랜덤을 누르면 지금과 다른 색 하나를 골라 저장한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#e03131", profileImageUrl: null });
    renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "내 설정" }));

    fireEvent.click(screen.getByRole("button", { name: "랜덤" }));
    saveProfile();

    await waitFor(() => expect(api.changeProfileColor).toHaveBeenCalled());
    expect(PROFILE_COLORS).toContain(api.changeProfileColor.mock.calls[0][0]);
  });

  it("randomColor는 지금 색을 고르지 않는다", () => {
    expect(randomColor("#e03131", () => 0)).toBe("#c2255c");
    expect(randomColor("#495057", () => 0.9999)).toBe("#e8590c");
  });

  it("이미지를 고르고 저장하면 올리고, 2MB를 넘으면 고르지 않고 안내한다", async () => {
    api.uploadProfileImage.mockResolvedValue({ profileColor: null, profileImageUrl: "/api/members/3/profile-image?v=1" });
    const client = renderModal();
    const input = screen.getByTestId("profile-image-input");

    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("프로필 이미지는 2MB까지 올릴 수 있습니다.")).toBeTruthy();
    expect(api.uploadProfileImage).not.toHaveBeenCalled();

    const small = new File(["png"], "me.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [small] } });
    expect(api.uploadProfileImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "내 설정" }));
    saveProfile();
    await waitFor(() => expect(client.getQueryData(["auth", "me"]))
      .toMatchObject({ profileImageUrl: "/api/members/3/profile-image?v=1" }));
  });

  it("내 정보에서 부서·직급·연락처를 고쳐 저장한다 (이름은 보여주기만)", async () => {
    renderModal();
    const phone = await screen.findByLabelText(/^전화번호/);
    expect((phone as HTMLInputElement).value).toBe("010-1111-2222");
    expect((screen.getAllByLabelText("이름")[0] as HTMLInputElement).readOnly).toBe(true);

    fireEvent.change(phone, { target: { value: "01099998888" } });
    fireEvent.click(within(screen.getByRole("tabpanel", { name: "개인정보 수정" })).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(members.updateMember).toHaveBeenCalledWith(3, {
      department: "개발팀", jobRank: "SENIOR", phone: "010-9999-8888", extension: "12",
    }));
    expect(await screen.findByText("저장했습니다.")).toBeTruthy();
  });
});
