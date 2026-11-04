export interface CollabConfig {
  port: number;
  backendUrl: string;
  internalToken: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CollabConfig {
  return {
    port: Number(env.COLLAB_PORT ?? 1234),
    backendUrl: env.BACKEND_URL ?? "http://localhost:8080",
    internalToken: env.INTERNAL_API_TOKEN ?? "dev-internal-token",
  };
}
