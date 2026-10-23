import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { TicketChat, TicketMessage } from "../components/types";
import * as retailApi from "./retailApi";
import { retailCommentToMessage, stripRetailPrefix } from "./mapping";

const CHAT_POLL_INTERVAL = 5_000; // 5s for active chats

/**
 * Hook that bridges retail ticket comments into the nokk_project chat interface.
 * Retail doesn't have a separate "chat" entity — comments on a ticket ARE the chat.
 */
export function useRetailTicketChat(retailTicketId?: string) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const realId = retailTicketId ? stripRetailPrefix(retailTicketId) : undefined;

  const fetchMessages = useCallback(
    async (id?: string) => {
      const ticketId = id ?? realId;
      if (!ticketId) return;
      setIsLoading(true);
      try {
        const { comments } = await retailApi.getComments(ticketId);
        setMessages((comments ?? []).map(retailCommentToMessage));
      } catch (err) {
        console.error("[retail] fetch comments error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [realId],
  );

  // Poll comments for the active ticket
  useEffect(() => {
    if (!realId) return;
    fetchMessages();
    intervalRef.current = setInterval(() => fetchMessages(), CHAT_POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [realId, fetchMessages]);

  const sendMessage = useCallback(
    async (content: string, joint?: string) => {
      if (!realId) return;

      // Optimistic add
      const tempMsg: TicketMessage = {
        id: `temp-${Date.now()}`,
        chat_id: `retail:${realId}`,
        send_by: "external",
        content,
        created_at: new Date().toISOString(),
        joint,
        send_profile: {
          id: "external",
          user_id: "external",
          full_name: "Nokk_project",
        },
      };
      setMessages((prev) => [...prev, tempMsg]);

      try {
        let attachment: { url: string; name: string; type: string } | undefined;
        if (joint) {
          const parsed = JSON.parse(joint) as {
            url: string;
            name: string;
            type: string;
          };
          attachment = { url: parsed.url, name: parsed.name, type: parsed.type };
        }
        const { comment } = await retailApi.addComment(realId, content, attachment);
        // Replace temp message with real one
        const realMsg = retailCommentToMessage(comment);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMsg.id ? realMsg : m)),
        );
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        toast.error("Message non envoyé (retail)");
      }
    },
    [realId],
  );

  /** For compatibility with the chat interface — retail doesn't need explicit chat creation */
  const getChatForTicket = useCallback(
    async (ticketId: string): Promise<TicketChat | null> => {
      const id = stripRetailPrefix(ticketId);
      return {
        id: `retail:${id}`,
        ticket_id: ticketId,
        assigned_user_id: "",
        owner_user_id: "",
        created_at: new Date().toISOString(),
      };
    },
    [],
  );

  const initializeChat = useCallback(
    async (ticketId: string): Promise<TicketChat | null> => {
      return getChatForTicket(ticketId);
    },
    [getChatForTicket],
  );

  return { messages, sendMessage, isLoading, getChatForTicket, initializeChat, fetchMessages };
}
