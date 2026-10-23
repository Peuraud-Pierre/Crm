import { TICKET_THEME } from "../ticket.theme";

// --- TYPES ---
export type TicketStatus = "ouvert" | "en_cours" | "résolu" | "clos";
export type TicketPriority = "nouveau" | "urgente" | "haute" | "moyenne" | "basse";
export type TicketCategory = "bug" | "feedback" | "amelioration" | "autre";
export type TicketConsoleExpedior = "Nokk_project" | "KS" | "KW" | "Retail" | "Autre";

export type TicketType =
  | "support_informatique"
  | "support_magasins"
  | "imprimante_reseau"
  | "proginov";

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  support_informatique: "Support informatique",
  support_magasins: "Support Magasins",
  imprimante_reseau: "Imprimante / Réseau",
  proginov: "Proginov",
};

export const TICKET_TYPE_OPTIONS: { value: TicketType; label: string }[] = (
  Object.keys(TICKET_TYPE_LABELS) as TicketType[]
).map((value) => ({ value, label: TICKET_TYPE_LABELS[value] }));

// RETRAIT de "priority"
export type SortOption = "newest" | "oldest"; 

export interface TicketFiltersState {
  search: string;
  category: TicketCategory | "all";
  status: TicketStatus | "all";
  priority: TicketPriority | "all"; 
  sort: SortOption;
  assignee: "all" | "mine" | string;
}

// ... (Le reste des interfaces reste inchangé)
export interface TicketProfile {
  id: string;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

export interface TicketAssignedProfile {
  id: string;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

export interface Ticket {
  id?: string; 
  title: string;
  description: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  created_at?: string;
  created_by?: string;
  assigned_to?: string | null;
  updated_at?: string;
  from?: TicketConsoleExpedior;
  type?: TicketType | null;
  assigned_profile?: TicketAssignedProfile | null;
  profiles?: TicketProfile | null;
}

export interface TicketChat {
  id: string;
  ticket_id: string;
  assigned_user_id: string;
  owner_user_id: string;
  created_at: string;
  closed_at?: string | null;
  assigned_profile?: TicketAssignedProfile | null;
  owner_profile?: TicketProfile | null;
}

export interface TicketMessage {
  id: string;
  chat_id: string;
  send_by: string;
  content: string;
  created_at: string;
  joint?: string; 
  send_profile?: TicketProfile;
}

// ... (Config visuelle inchangée)
export const PRIORITY_COLUMNS_CONFIG = [
  { id: "nouveau", label: "Nouveau", barColor: TICKET_THEME.colors.priority.nouveau, countBadge: TICKET_THEME.colors.countBadge.nouveau },
  { id: "urgente", label: "Urgente", barColor: TICKET_THEME.colors.priority.urgente, countBadge: TICKET_THEME.colors.countBadge.urgente },
  { id: "haute", label: "Haute", barColor: TICKET_THEME.colors.priority.haute, countBadge: TICKET_THEME.colors.countBadge.haute },
  { id: "moyenne", label: "Moyenne", barColor: TICKET_THEME.colors.priority.moyenne, countBadge: TICKET_THEME.colors.countBadge.moyenne },
  { id: "basse", label: "Basse", barColor: TICKET_THEME.colors.priority.basse, countBadge: TICKET_THEME.colors.countBadge.basse },
];