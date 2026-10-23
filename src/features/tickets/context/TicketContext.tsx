import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  useCallback
} from "react";
import type { 
  Ticket, 
  TicketFiltersState, 
  TicketCategory, 
  TicketStatus, 
  TicketPriority,
  SortOption,
  TicketChat
} from "../components/types";
import { useTickets } from "../hooks/useTickets";
import { useTicketChat } from "../hooks/useTicketChat";
import { useRetailTickets } from "../retail/useRetailTickets";
import { useRetailTicketChat } from "../retail/useRetailTicketChat";
import { isRetailId } from "../retail/mapping";
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider";
import { useProfilesCtx } from "@/shared/context/ProfilesProvider";
import { toast } from "sonner";

interface TicketContextType {
  // Données Tickets
  tickets: Ticket[];
  filteredTickets: Ticket[];
  techUsers: { id: string; name: string }[];
  isLoading: boolean;


  // Filtres
  filters: TicketFiltersState;
  setSearch: (val: string) => void;
  setCategory: (val: TicketCategory | "all") => void;
  setStatus: (val: TicketStatus | "all") => void;
  setPriority: (val: TicketPriority | "all") => void;
  setAssignee: (val: "all" | "mine" | string) => void;
  setSort: (val: SortOption) => void;
  resetFilters: () => void;

  // Actions CRUD Ticket
  createTicket: (ticket: Ticket) => Promise<void>;
  updateTicket: (ticket: Ticket) => Promise<void>;
  deleteTicket: (ticketId: string) => Promise<void>;

  // Actions Chat
  getChatForTicket: (ticketId: string) => Promise<TicketChat | null>;
  initializeChat: (ticketId: string, ownerId: string) => Promise<TicketChat | null>;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

export function TicketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profiles } = useProfilesCtx();
  
  // Hooks de données (Supabase natif)
  const {
    tickets: serverTickets,
    fetchTickets,
    createTicket: apiCreate,
    updateTicket: apiUpdate,
    deleteTicket: apiDelete
  } = useTickets();

  const { fetchSingleChat, createChat } = useTicketChat();

  // Hooks de données (Retail externe)
  const {
    tickets: retailTickets,
    isLoading: retailLoading,
    updateTicket: retailUpdate,
    deleteTicket: retailDelete,
    isConfigured: retailConfigured,
  } = useRetailTickets();

  const {
    getChatForTicket: retailGetChat,
    initializeChat: retailInitChat,
  } = useRetailTicketChat();

  const [isLoading, setIsLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Synchronisation : merge tickets Supabase + Retail
  useEffect(() => {
    if (serverTickets) {
      const merged = [...serverTickets, ...retailTickets];
      // Resync de la liste depuis les sources serveur/retail (entités externes).
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setTickets(merged);
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setIsLoading(retailConfigured ? retailLoading : false);
    }
  }, [serverTickets, retailTickets, retailLoading, retailConfigured]);

  // --- LOGIQUE CHAT (dispatch Supabase vs Retail) ---
  const getChatForTicket = useCallback(async (ticketId: string) => {
    if (isRetailId(ticketId)) {
      return await retailGetChat(ticketId);
    }
    return await fetchSingleChat(ticketId);
  }, [fetchSingleChat, retailGetChat]);

  const initializeChat = useCallback(async (ticketId: string, ownerId: string) => {
    if (isRetailId(ticketId)) {
      return await retailInitChat(ticketId);
    }
    return await createChat(ticketId, ownerId);
  }, [createChat, retailInitChat]);

  // --- FILTRES & TECH USERS ---
  const techUsers = useMemo(() => {
    if (!profiles) return [];
    const uniqueTechsMap = new Map();
    
    profiles
      .filter(profile => profile.service?.nom === 'Tech')
      .forEach(u => {
        if (u.user_id) {
          uniqueTechsMap.set(u.user_id, {
            id: u.user_id,
            name: u.full_name || u.email || "Utilisateur"
          });
        }
      });

    if (user) uniqueTechsMap.delete(user.user_id);
    return Array.from(uniqueTechsMap.values());
  }, [profiles, user]);


  const [filters, setFilters] = useState<TicketFiltersState>({
    search: "",
    category: "all",
    status: "all",
    priority: "all",
    sort: "newest",
    assignee: "all",
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    let result = [...tickets];

    if (filters.assignee !== 'all') {
      if (filters.assignee === 'mine' && user) {
        result = result.filter((t) => t.assigned_to === user.user_id);
      } else {
        result = result.filter((t) => t.assigned_to === filters.assignee);
      }
    }
    if (filters.status !== "all") result = result.filter((t) => t.status === filters.status);
    if (filters.category !== "all") result = result.filter((t) => t.category === filters.category);
    if (filters.priority !== "all") result = result.filter((t) => t.priority === filters.priority);

    if (filters.search.trim()) {
      const s = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.description?.toLowerCase().includes(s) ||
          t.profiles?.full_name?.toLowerCase().includes(s)
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return filters.sort === "oldest" ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [tickets, filters, user]);

  // --- ACTIONS FILTRES ---
  const setSearch = (s: string) => setFilters(p => ({ ...p, search: s }));
  const setCategory = (c: TicketCategory | "all") => setFilters(p => ({ ...p, category: c }));
  const setStatus = (s: TicketStatus | "all") => setFilters(p => ({ ...p, status: s }));
  const setPriority = (pr: TicketPriority | "all") => setFilters(p => ({ ...p, priority: pr }));
  const setAssignee = (a: string) => setFilters(p => ({ ...p, assignee: a }));
  const setSort = (so: SortOption) => setFilters(p => ({ ...p, sort: so }));
  const resetFilters = () => setFilters({ search: "", category: "all", status: "all", priority: "all", sort: "newest", assignee: "all" });

  // --- ACTIONS CRUD OPTIMISTES (dispatch Supabase vs Retail) ---
  const updateTicket = async (t: Ticket) => {
    const previousTickets = [...tickets];
    setTickets(prev => prev.map(old => (old.id === t.id ? { ...old, ...t } : old)));

    try {
      if (t.id && isRetailId(t.id)) {
        await retailUpdate(t);
      } else {
        await apiUpdate(t);
      }
    } catch {
      setTickets(previousTickets);
      fetchTickets();
    }
  };

  const createTicket = async (t: Ticket) => {
    try {
      await apiCreate(t);
    } catch {
      toast.error("Erreur lors de la création du ticket");
    }
  };

  const deleteTicket = async (id: string) => {
    const previousTickets = [...tickets];
    setTickets(prev => prev.filter(t => t.id !== id));
    try {
      if (isRetailId(id)) {
        await retailDelete(id);
      } else {
        await apiDelete(id);
      }
    } catch {
      setTickets(previousTickets);
    }
  };

  const value = useMemo(() => ({
    tickets, 
    filteredTickets, 
    techUsers, 
    isLoading,
    filters, 
    setSearch, 
    setCategory, 
    setStatus, 
    setPriority, 
    setAssignee, 
    setSort, 
    resetFilters,
    createTicket, 
    updateTicket, 
    deleteTicket,
    getChatForTicket,
    initializeChat
  }), [tickets, filteredTickets, techUsers, isLoading, filters, getChatForTicket, initializeChat]);

  return <TicketContext value={value}>{children}</TicketContext>;
}

export const useTicketContext = () => {
  const context = use(TicketContext);
  if (!context) throw new Error("useTicketContext must be used within TicketProvider");
  return context;
};