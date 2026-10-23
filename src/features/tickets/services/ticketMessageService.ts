import { supabase } from "@/integrations/supabase/client";
import type { TicketMessage } from "../components/types";

// Requête optimisée
const MESSAGE_SELECT_QUERY = `
  *,
  send_profile:profiles!send_by(*)
`;

export async function fetchMessages(chatId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from("ticket_message")
    .select(MESSAGE_SELECT_QUERY)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((msg) => ({
    ...(msg as Record<string, unknown>),
    content: (msg as { text?: string }).text,
  })) as TicketMessage[];
}

export async function sendMessage(
  chatId: string,
  sendBy: string,
  content: string,
  joint?: string,
): Promise<void> {
  const { error } = await supabase
    .from("ticket_message")
    .insert([{
      chat_id: chatId,
      send_by: sendBy,
      text: content,
      joint: joint
    }]);

  if (error) throw error;
}

export async function fetchSingleMessage(id: string): Promise<TicketMessage | null> {
  const { data, error } = await supabase
    .from("ticket_message")
    .select(MESSAGE_SELECT_QUERY)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    content: (data as { text?: string }).text,
  } as TicketMessage;
}
