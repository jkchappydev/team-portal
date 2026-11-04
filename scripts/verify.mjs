// 전체 검증: backend → collab → frontend 순서로 실행하고 하나라도 실패하면 즉시 중단
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";
const gradlew = isWin ? ".\\gradlew.bat" : "./gradlew";

const steps = [
  { name: "backend", cwd: "backend", commands: [[gradlew, "test", "build"]] },
  {
    name: "collab",
    cwd: "collab",
    commands: [["npm", "test"], ["npm", "run", "typecheck"], ["npm", "run", "build"]],
  },
  {
    name: "frontend",
    cwd: "frontend",
    commands: [["npx", "vitest", "run"], ["npm", "run", "lint"], ["npm", "run", "build"]],
  },
];

for (const step of steps) {
  for (const [cmd, ...args] of step.commands) {
    console.log(`\n[verify:${step.name}] ${cmd} ${args.join(" ")}`);
    const result = spawnSync(cmd, args, { cwd: step.cwd, stdio: "inherit", shell: isWin });
    if (result.status !== 0) {
      console.error(`\n[verify:${step.name}] 실패`);
      process.exit(result.status ?? 1);
    }
  }
}
console.log("\n[verify] 모든 모듈 검증 통과");
