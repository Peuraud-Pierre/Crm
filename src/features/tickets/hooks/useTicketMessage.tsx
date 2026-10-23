import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider";
import { toast } from "sonner";
import type { TicketMessage } from "../components/types";
import * as ticketMessageService from "../services/ticketMessageService";
import { subscribeToTable } from "../services/ticketRealtimeService";

export function useTicketMessage(chatId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch initial
  const fetchMessages = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const formattedMessages = await ticketMessageService.fetchMessages(id);
      setMessages(formattedMessages);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Send Message (Optimistic)
  const sendMessage = useCallback(async (content: string, joint?: string) => {
    if (!user || !chatId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: TicketMessage = {
      id: tempId,
      chat_id: chatId,
      send_by: user.user_id,
      content: content,
      created_at: new Date().toISOString(),
      joint: joint,
      send_profile: { 
        id: user.user_id, 
        user_id: user.user_id, 
        full_name: user.user_metadata?.full_name || "Moi" 
      }
    };

    // Ajout immédiat
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      await ticketMessageService.sendMessage(chatId, user.user_id, content, joint);
      // On ne fait rien ici en cas de succès, on laisse le Realtime faire le remplacement
    } catch (err) {
      // En cas d'erreur, on retire le message optimiste pour ne pas laisser un faux positif
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Message non envoyé");
      console.error("Error sending message:", err);
    }
  }, [user, chatId]);

  // 3. Realtime (Smart Swap Logic)
  useEffect(() => {
    if (!chatId) return;

    fetchMessages(chatId);

    const unsubscribe = subscribeToTable<TicketMessage>(
      `chat_messages_${chatId}`,
      "ticket_message",
      `chat_id=eq.${chatId}`,
      async ({ eventType, newRow }) => {
          // Seuls les INSERT nous intéressent (comportement d'origine)
          if (eventType !== "INSERT" || !newRow.id) return;
          // Récupération de la donnée complète (avec profil)
          const newMessage = await ticketMessageService.fetchSingleMessage(newRow.id);

          if (newMessage) {
            setMessages(prev => {
              // 1. Si le message existe déjà (doublon strict d'ID), on ne fait rien
              if (prev.some(m => m.id === newMessage.id)) return prev;

              // 2. Recherche intelligente : Est-ce qu'on a un message temporaire identique ?
              // (Même contenu + Même auteur + ID qui commence par "temp-")
              const tempIndex = prev.findIndex(m => 
                m.id.startsWith('temp-') && 
                m.content === newMessage.content && 
                m.send_by === newMessage.send_by
              );

              if (tempIndex !== -1) {
                // NOKK_PROJECT : C'est notre message optimiste qui revient du serveur.
                // On remplace l'objet temporaire par le vrai objet (avec le vrai ID et la vraie date)
                // Cela évite l'ajout en doublon et le scintillement.
                const newMessages = [...prev];
                newMessages[tempIndex] = newMessage;
                return newMessages;
              }

              // 3. Sinon, c'est un nouveau message (venant de quelqu'un d'autre), on l'ajoute à la fin
              return [...prev, newMessage];
            });
          }
        }
      );

    return unsubscribe;
  }, [chatId, fetchMessages]);

  return { messages, sendMessage, isLoading };
}