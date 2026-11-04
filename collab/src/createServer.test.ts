import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import type { Server } from "@hocuspocus/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import * as Y from "yjs";
import type { BackendClient } from "./backendClient.js";
import { type CreateServerOptions, createServer } from "./createServer.js";

const config = { port: 0, backendUrl: "http://backend", internalToken: "t" };

function mockClient(overrides: Partial<BackendClient> = {}): BackendClient {
  return {
    authorize: vi.fn().mockResolvedValue({ userName: "홍길동" }),
    fetchContent: vi.fn().mockResolvedValue(null),
    storeContent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let server: Server | undefined;
const providers: HocuspocusProvider[] = [];
const sockets: HocuspocusProviderWebsocket[] = [];

async function start(client: BackendClient, options: CreateServerOptions = {}) {
  server = createServer(config, client, { debounce: 50, maxDebounce: 100, ...options });
  await server.listen(0);
  return `ws://127.0.0.1:${server.address.port}`;
}

function connect(url: string, name: string, token: string, handlers = {}) {
  const socket = new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WebSocket });
  sockets.push(socket);
  const provider = new HocuspocusProvider({ websocketProvider: socket, name, token, ...handlers });
  provider.attach();
  providers.push(provider);
  return provider;
}

afterEach(async () => {
  providers.splice(0).forEach((p) => p.destroy());
  sockets.splice(0).forEach((s) => s.destroy());
  await server?.destroy();
  server = undefined;
});

describe("createServer", () => {
  it("문서 이름 형식이 틀리면 인증 거부", async () => {
    const client = mockClient();
    const url = await start(client);
    const failed = new Promise<void>((resolve) => {
      connect(url, "foo", "1", { onAuthenticationFailed: () => resolve() });
    });
    await failed;
    expect(client.authorize).not.toHaveBeenCalled();
  });

  it("authorize가 throw하면 연결 거부", async () => {
    const client = mockClient({ authorize: vi.fn().mockRejectedValue(new Error("404")) });
    const url = await start(client);
    const failed = new Promise<void>((resolve) => {
      connect(url, "document-9", "1", { onAuthenticationFailed: () => resolve() });
    });
    await failed;
    expect(client.authorize).toHaveBeenCalledWith(9, 1);
  });

  it("편집 후 storeContent가 plainText, updatedBy와 함께 호출된다", async () => {
    const client = mockClient();
    const url = await start(client);
    const provider = connect(url, "document-5", "7");
    await new Promise<void>((resolve) => provider.on("synced", () => resolve()));

    provider.document.transact(() => {
      const group = new Y.XmlElement("blockGroup");
      const container = new Y.XmlElement("blockContainer");
      const paragraph = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      provider.document.getXmlFragment("document-store").insert(0, [group]);
      group.insert(0, [container]);
      container.insert(0, [paragraph]);
      paragraph.insert(0, [text]);
      text.insert(0, "안녕");
    });

    await vi.waitFor(() => expect(client.storeContent).toHaveBeenCalled(), { timeout: 3000 });
    const [documentId, state, plainText, updatedBy] = vi.mocked(client.storeContent).mock.calls[0];
    expect(documentId).toBe(5);
    expect(state.length).toBeGreaterThan(0);
    expect(plainText).toBe("안녕");
    expect(updatedBy).toBe(7);
  });

  it("storeContent가 한 번 실패해도 이후 저장에 전체 상태가 전달된다", async () => {
    const storeContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("backend down"))
      .mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = mockClient({ storeContent });
    const url = await start(client);
    const provider = connect(url, "document-6", "7");
    await new Promise<void>((resolve) => provider.on("synced", () => resolve()));

    const text = new Y.XmlText();
    provider.document.transact(() => {
      const group = new Y.XmlElement("blockGroup");
      const container = new Y.XmlElement("blockContainer");
      const paragraph = new Y.XmlElement("paragraph");
      provider.document.getXmlFragment("document-store").insert(0, [group]);
      group.insert(0, [container]);
      container.insert(0, [paragraph]);
      paragraph.insert(0, [text]);
      text.insert(0, "첫 내용");
    });
    await vi.waitFor(() => expect(storeContent).toHaveBeenCalledTimes(1), { timeout: 3000 });

    provider.document.transact(() => text.insert(text.length, " 추가"));
    await vi.waitFor(() => expect(storeContent).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(storeContent.mock.calls[1][2]).toBe("첫 내용 추가");
  });

  it("저장 실패 후 마지막 사용자가 나가도 문서를 유지하고 재시도 성공 후 언로드한다", async () => {
    const storeContent = vi
      .fn()
      .mockRejectedValueOnce(new Error("backend down"))
      .mockRejectedValueOnce(new Error("backend down"))
      .mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = mockClient({ storeContent });
    const url = await start(client, { retryInterval: 300 });
    const provider = connect(url, "document-10", "7");
    await new Promise<void>((resolve) => provider.on("synced", () => resolve()));

    provider.document.transact(() => {
      const group = new Y.XmlElement("blockGroup");
      const container = new Y.XmlElement("blockContainer");
      const paragraph = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      provider.document.getXmlFragment("document-store").insert(0, [group]);
      group.insert(0, [container]);
      container.insert(0, [paragraph]);
      paragraph.insert(0, [text]);
      text.insert(0, "마지막 내용");
    });
    await vi.waitFor(() => expect(storeContent).toHaveBeenCalledTimes(1), { timeout: 3000 });

    // 마지막 사용자 퇴장
    providers.splice(0).forEach((p) => p.destroy());
    sockets.splice(0).forEach((s) => s.destroy());

    // 재시도가 실패하는 동안 문서는 메모리에 남아 있어야 함
    await vi.waitFor(() => expect(storeContent).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(server?.hocuspocus.getDocumentsCount()).toBe(1);

    await vi.waitFor(() => expect(storeContent).toHaveBeenCalledTimes(3), { timeout: 3000 });
    const [documentId, state, plainText, updatedBy] = storeContent.mock.calls[2];
    expect(documentId).toBe(10);
    expect(state.length).toBeGreaterThan(0);
    expect(plainText).toBe("마지막 내용");
    expect(updatedBy).toBe(7);
    await vi.waitFor(() => expect(server?.hocuspocus.getDocumentsCount()).toBe(0), {
      timeout: 3000,
    });
  });

  it("fetchContent가 돌려준 상태를 새 연결이 받는다", async () => {
    const source = new Y.Doc();
    const group = new Y.XmlElement("blockGroup");
    const container = new Y.XmlElement("blockContainer");
    const paragraph = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    source.getXmlFragment("document-store").insert(0, [group]);
    group.insert(0, [container]);
    container.insert(0, [paragraph]);
    paragraph.insert(0, [text]);
    text.insert(0, "저장된 내용");
    const client = mockClient({
      fetchContent: vi.fn().mockResolvedValue(Y.encodeStateAsUpdate(source)),
    });
    const url = await start(client);
    const provider = connect(url, "document-8", "7");
    await new Promise<void>((resolve) => provider.on("synced", () => resolve()));

    expect(provider.document.getXmlFragment("document-store").toString()).toContain("저장된 내용");
    expect(client.fetchContent).toHaveBeenCalledWith(8);
  });
});
