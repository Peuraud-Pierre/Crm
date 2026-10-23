import { useTicketMessage } from "./useTicketMessage";
import { useRetailTicketChat } from "../retail/useRetailTicketChat";
import { isRetailId } from "../retail/mapping";
import type { TicketMessage } from "../components/types";

/**
 * Dispatches between the Supabase ticket_message hook and the retail
 * comments-as-chat hook based on the chat ID prefix.
 *
 * Both underlying hooks are called every render (Rules of Hooks),
 * but only one is "active" — the other gets an undefined ID and
 * short-circuits internally.
 */
export function useUnifiedTicketMessage(chatId?: string): {
  messages: TicketMessage[];
  sendMessage: (content: string, joint?: string) => Promise<void>;
  isLoading: boolean;
} {
  const isRetail = !!chatId && isRetailId(chatId);

  const supabaseHook = useTicketMessage(isRetail ? undefined : chatId);
  const retailHook = useRetailTicketChat(isRetail ? chatId : undefined);

  if (isRetail) {
    return {
      messages: retailHook.messages,
      sendMessage: retailHook.sendMessage,
      isLoading: retailHook.isLoading,
    };
  }
  return supabaseHook;
}
