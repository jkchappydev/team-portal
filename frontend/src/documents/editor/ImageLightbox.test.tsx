import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ImageLightbox, openImageLightbox } from "./ImageLightbox";

describe("ImageLightbox", () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(cleanup);

  it("펼치기를 누르면 이미지를 크게 띄우고, 이미지를 누르면 닫는다", async () => {
    render(<MantineProvider><ImageLightbox /></MantineProvider>);
    expect(screen.queryByRole("img")).toBeNull();
    act(() => openImageLightbox({ url: "/files/banner.png", name: "배너.png" }));
    const image = await screen.findByRole("img", { name: "배너.png" });
    expect(image.getAttribute("src")).toBe("/files/banner.png");
    fireEvent.click(image);
    await waitFor(() => expect(screen.queryByRole("img", { name: "배너.png" })).toBeNull());
  });
});
