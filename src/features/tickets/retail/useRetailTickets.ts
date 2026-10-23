import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { env } from "@/shared/lib/env";
import type { Ticket } from "../components/types";
import * as retailApi from "./retailApi";
import {
  retailTicketToLocal,
  stripRetailPrefix,
  toRetailPriority,
  toRetailStatus,
} from "./mapping";

const POLL_INTERVAL = 15_000; // 15s polling (retail has no Supabase realtime)

export function useRetailTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const isConfigured = !!env.PUBLIC_RETAIL_API_URL;

  const fetchTickets = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const { tickets: raw } = await retailApi.listTickets({ page_size: 200 });
      setTickets((raw ?? []).map(retailTicketToLocal));
    } catch (err) {
      console.error("[retail] fetch tickets error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  // Initial fetch + polling
  useEffect(() => {
    if (!isConfigured) {
      // Reset contrôlé de l'état de chargement quand l'API retail n'est pas configurée.
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setIsLoading(false);
      return;
    }

    fetchTickets();
    intervalRef.current = setInterval(fetchTickets, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [isConfigured, fetchTickets]);

  const updateTicket = useCallback(
    async (ticket: Ticket) => {
      if (!ticket.id) return;
      const retailId = stripRetailPrefix(ticket.id);

      try {
        if (ticket.status) {
          await retailApi.updateStatus(retailId, toRetailStatus(ticket.status));
        }
        if (ticket.priority) {
          await retailApi.updatePriority(retailId, toRetailPriority(ticket.priority));
        }
        if (ticket.assigned_to !== undefined) {
          await retailApi.assignTicket(retailId, ticket.assigned_to ?? "");
        }
      } catch (err) {
        toast.error(
          `Erreur retail: ${err instanceof Error ? err.message : err}`,
        );
        throw err;
      }
    },
    [],
  );

  const deleteTicket = useCallback(async (ticketId: string) => {
    const retailId = stripRetailPrefix(ticketId);
    try {
      await retailApi.deleteTicket(retailId);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch (err) {
      toast.error(
        `Erreur retail: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }, []);

  return { tickets, isLoading, fetchTickets, updateTicket, deleteTicket, isConfigured };
}
