import { env } from "@/shared/lib/env";
import { getAccessToken } from "../services/ticketRealtimeService";
import type { RetailComment, RetailHistory, RetailTicket, RetailUser } from "./mapping";

const BASE_URL = env.PUBLIC_RETAIL_API_URL ?? "";

async function retailFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/api/v1/external${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Retail API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Tickets ───────────────────────────────────────────────────────────

export async function listTickets(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  page?: number;
  page_size?: number;
}): Promise<{ tickets: RetailTicket[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.priority) params.set("priority", filters.priority);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.page_size) params.set("page_size", String(filters.page_size));

  const qs = params.toString();
  return retailFetch(`/tickets${qs ? `?${qs}` : ""}`);
}

export async function getTicket(id: string): Promise<{ ticket: RetailTicket }> {
  return retailFetch(`/tickets/${id}`);
}

export async function updateStatus(id: string, status: string): Promise<{ ticket: RetailTicket }> {
  return retailFetch(`/tickets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function assignTicket(id: string, assigneeId: string): Promise<{ ticket: RetailTicket }> {
  return retailFetch(`/tickets/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ assignee_id: assigneeId }),
  });
}

export async function updatePriority(id: string, priority: string): Promise<{ ticket: RetailTicket }> {
  return retailFetch(`/tickets/${id}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority }),
  });
}

export async function deleteTicket(id: string): Promise<void> {
  await retailFetch(`/tickets/${id}`, { method: "DELETE" });
}

// ── Comments (= chat messages for nokk_project) ───────────────────────

export async function getComments(ticketId: string): Promise<{ comments: RetailComment[] }> {
  return retailFetch(`/tickets/${ticketId}/comments`);
}

export async function addComment(
  ticketId: string,
  content: string,
  attachment?: { url: string; name: string; type: string },
): Promise<{ comment: RetailComment }> {
  return retailFetch(`/tickets/${ticketId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      content,
      attachment_url: attachment?.url ?? "",
      attachment_name: attachment?.name ?? "",
      attachment_type: attachment?.type ?? "",
    }),
  });
}

// ── History ───────────────────────────────────────────────────────────

export async function getHistory(ticketId: string): Promise<{ history: RetailHistory[] }> {
  return retailFetch(`/tickets/${ticketId}/history`);
}

// ── Users (for assignee picker) ───────────────────────────────────────

export async function listUsers(): Promise<{ users: RetailUser[] }> {
  return retailFetch("/users");
}

// ── Bulk actions ──────────────────────────────────────────────────────

export async function bulkAction(
  action: string,
  ticketIds: string[],
  extra?: { status?: string; priority?: string; assignee_id?: string },
): Promise<{ updated?: number; deleted?: number }> {
  return retailFetch("/tickets/bulk", {
    method: "POST",
    body: JSON.stringify({ action, ticket_ids: ticketIds, ...extra }),
  });
}
