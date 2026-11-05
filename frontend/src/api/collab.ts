import { apiFetch } from "./client";
export async function fetchCollabTicket(): Promise<string> {
  return (await apiFetch<{ ticket: string }>("/api/collab/tickets", { method: "POST" })).ticket;
}
