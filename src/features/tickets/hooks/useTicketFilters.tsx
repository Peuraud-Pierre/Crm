import { useState, useMemo } from "react";
import type { Ticket, TicketCategory, TicketStatus } from "../components/types";

export type SortOption = "newest" | "oldest";

export interface TicketFiltersState {
  search: string;
  category: TicketCategory | "all";
  status: TicketStatus | "all"; // "all" pour tout voir
  sort: SortOption;
}

export function useTicketFilters(tickets: Ticket[]) {
  // État initial des filtres
  const [filters, setFilters] = useState<TicketFiltersState>({
    search: "",
    category: "all",
    status: "ouvert", // <--- Par défaut sur "ouvert" comme demandé
    sort: "newest",
  });

  // Calcul mémorisé des tickets filtrés
  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    // 1. Filtre par Status
    if (filters.status !== "all") {
      result = result.filter((t) => t.status === filters.status);
    }

    // 2. Filtre par Catégorie
    if (filters.category !== "all") {
      result = result.filter((t) => t.category === filters.category);
    }

    // 3. Recherche (Titre ou Description)
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }

    // 4. Tri par Date
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return filters.sort === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [tickets, filters]);

  // Helpers pour mettre à jour les filtres
  const setSearch = (search: string) => setFilters((prev) => ({ ...prev, search }));
  const setCategory = (category: TicketCategory | "all") => setFilters((prev) => ({ ...prev, category }));
  const setStatus = (status: TicketStatus | "all") => setFilters((prev) => ({ ...prev, status }));
  const setSort = (sort: SortOption) => setFilters((prev) => ({ ...prev, sort }));
  
  const resetFilters = () => setFilters({
      search: "",
      category: "all",
      status: "all", // Reset sur "all" ou "ouvert" selon ta préférence
      sort: "newest"
  });

  return {
    filters,
    filteredTickets,
    setSearch,
    setCategory,
    setStatus,
    setSort,
    resetFilters
  };
}