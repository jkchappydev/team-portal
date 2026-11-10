import { MantineProvider } from "@mantine/core";
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
    window.matchMedia ??= ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("이름 아래에 내 이메일 주소를 보여 준다", () => {
    renderModal();
    expect(screen.getByText("hong@example.com")).toBeTruthy();
  });

  it("색을 고르면 저장하고 로그인 정보에 바로 반영한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#1971c2", profileImageUrl: null });
    const client = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "색 #1971c2" }));

    await waitFor(() => expect(client.getQueryData(["auth", "me"])).toMatchObject({ profileColor: "#1971c2" }));
    expect(api.changeProfileColor.mock.calls[0][0]).toBe("#1971c2");
  });

  it("랜덤을 누르면 지금과 다른 색 하나를 골라 저장한다", async () => {
    api.changeProfileColor.mockResolvedValue({ profileColor: "#e03131", profileImageUrl: null });
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "랜덤" }));

    await waitFor(() => expect(api.changeProfileColor).toHaveBeenCalled());
    expect(PROFILE_COLORS).toContain(api.changeProfileColor.mock.calls[0][0]);
  });

  it("randomColor는 지금 색을 고르지 않는다", () => {
    expect(randomColor("#e03131", () => 0)).toBe("#c2255c");
    expect(randomColor("#495057", () => 0.9999)).toBe("#e8590c");
  });

  it("이미지를 고르면 올리고, 2MB를 넘으면 올리지 않고 안내한다", async () => {
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
  });
});
