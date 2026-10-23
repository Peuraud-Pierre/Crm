import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  Ticket,
  TicketMessage,
} from "../components/types";

// ── Status mapping (retail EN <-> nokk_project FR) ─────────────────────

const STATUS_TO_RETAIL: Record<TicketStatus, string> = {
  ouvert: "open",
  en_cours: "in_progress",
  "résolu": "resolved",
  clos: "closed",
};

const STATUS_FROM_RETAIL: Record<string, TicketStatus> = {
  open: "ouvert",
  in_progress: "en_cours",
  resolved: "résolu",
  closed: "clos",
};

export function toRetailStatus(status: TicketStatus): string {
  return STATUS_TO_RETAIL[status] ?? "open";
}

export function fromRetailStatus(status: string): TicketStatus {
  return STATUS_FROM_RETAIL[status] ?? "ouvert";
}

// ── Priority mapping ──────────────────────────────────────────────────
// retail: low, medium, high, critical
// nokk_project: nouveau, basse, moyenne, haute, urgente
//
// "nouveau" has no retail equivalent — we map it to "low".

const PRIORITY_TO_RETAIL: Record<TicketPriority, string> = {
  nouveau: "low",
  basse: "low",
  moyenne: "medium",
  haute: "high",
  urgente: "critical",
};

const PRIORITY_FROM_RETAIL: Record<string, TicketPriority> = {
  low: "basse",
  medium: "moyenne",
  high: "haute",
  critical: "urgente",
};

export function toRetailPriority(priority: TicketPriority): string {
  return PRIORITY_TO_RETAIL[priority] ?? "medium";
}

export function fromRetailPriority(priority: string): TicketPriority {
  return PRIORITY_FROM_RETAIL[priority] ?? "moyenne";
}

// ── Category mapping ──────────────────────────────────────────────────
// retail: technical, billing, general, product, other
// nokk_project: bug, feedback, amelioration, autre

const CATEGORY_TO_RETAIL: Record<TicketCategory, string> = {
  bug: "technical",
  feedback: "general",
  amelioration: "product",
  autre: "other",
};

const CATEGORY_FROM_RETAIL: Record<string, TicketCategory> = {
  technical: "bug",
  billing: "autre",
  general: "feedback",
  product: "amelioration",
  other: "autre",
};

export function toRetailCategory(category: TicketCategory): string {
  return CATEGORY_TO_RETAIL[category] ?? "other";
}

export function fromRetailCategory(category: string): TicketCategory {
  return CATEGORY_FROM_RETAIL[category] ?? "autre";
}

// ── Raw retail API types ──────────────────────────────────────────────

export interface RetailTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  creator_id: string;
  creator_name: string;
  assignee_id: string | null;
  assignee_name: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface RetailComment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  content: string;
  attachment_url: string;
  attachment_name: string;
  attachment_type: string;
  created_at: string;
}

export interface RetailHistory {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name: string;
  action: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

export interface RetailUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

// ── Converters ────────────────────────────────────────────────────────

export function retailTicketToLocal(rt: RetailTicket): Ticket {
  return {
    id: `retail:${rt.id}`,
    title: rt.title,
    description: rt.description,
    status: fromRetailStatus(rt.status),
    priority: fromRetailPriority(rt.priority),
    category: fromRetailCategory(rt.category),
    created_at: rt.created_at,
    created_by: rt.creator_id,
    assigned_to: rt.assignee_id,
    updated_at: rt.updated_at,
    from: "Retail",
    profiles: {
      id: rt.creator_id,
      user_id: rt.creator_id,
      full_name: rt.creator_name,
    },
    assigned_profile: rt.assignee_id
      ? {
          id: rt.assignee_id,
          user_id: rt.assignee_id,
          full_name: rt.assignee_name,
        }
      : null,
  };
}

export function retailCommentToMessage(rc: RetailComment): TicketMessage {
  return {
    id: `retail:${rc.id}`,
    chat_id: `retail:${rc.ticket_id}`,
    send_by: rc.author_id,
    content: rc.content,
    created_at: rc.created_at,
    joint: rc.attachment_url
      ? JSON.stringify({
          url: rc.attachment_url,
          name: rc.attachment_name,
          type: rc.attachment_type,
        })
      : undefined,
    send_profile: {
      id: rc.author_id,
      user_id: rc.author_id,
      full_name: rc.author_name,
    },
  };
}

/** Strip the "retail:" prefix to get the original retail UUID */
export function stripRetailPrefix(id: string): string {
  return id.startsWith("retail:") ? id.slice(7) : id;
}

/** Check if a ticket/message ID belongs to the retail platform */
export function isRetailId(id: string): boolean {
  return id.startsWith("retail:");
}
