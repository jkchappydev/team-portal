// 개발 환경 실행: DB 컨테이너 기동 후 collab·frontend dev 서버를 함께 실행 (backend는 IntelliJ에서 실행)
import { spawn, spawnSync } from "node:child_process";

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

const db = spawnSync("docker", ["compose", "-f", "docker-compose.dev.yml", "up", "-d"], { stdio: "inherit" });
if (db.status !== 0) {
  process.exit(db.status ?? 1);
}

// Windows에서는 .cmd 실행에 shell이 필요
const children = ["collab", "frontend"].map((dir) =>
  spawn(npm, ["--prefix", dir, "run", "dev"], { stdio: "inherit", shell: isWin }),
);

// 종료 시 자식 프로세스 정리
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (isWin && child.pid) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
};

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const child of children) {
  child.on("exit", (code) => stop(code ?? 0));
}
