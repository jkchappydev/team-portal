import { createBackendClient } from "./backendClient.js";
import { loadConfig } from "./config.js";
import { createServer } from "./createServer.js";

// 종료 시 저장 재시도를 기다리는 최대 시간
const SHUTDOWN_TIMEOUT_MS = 30_000;

const config = loadConfig();
const server = createServer(config, createBackendClient(config));

server.listen(config.port).then(() => {
  console.log(`[collab] ws://localhost:${config.port} 에서 대기 중`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS);
    });
    Promise.race([server.destroy().then(() => "done" as const), timeout])
      .then((result) => {
        if (result === "timeout") {
          // 제한 시간 안에 저장되지 못해 메모리에 남은 문서는 유실됨
          const unsaved = [...server.hocuspocus.documents.keys()];
          console.error(`[collab] 종료 제한 시간 초과, 저장되지 않은 문서: ${unsaved.join(", ") || "없음"}`);
          process.exit(1);
        }
        process.exit(0);
      })
      .catch((error) => {
        console.error("[collab] 종료 중 오류", error);
        process.exit(1);
      })
      .finally(() => clearTimeout(timer));
  });
}
