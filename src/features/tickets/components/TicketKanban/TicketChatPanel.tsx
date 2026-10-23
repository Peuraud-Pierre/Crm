import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/shared/ui/atoms/scroll-area";
import { Input } from "@/shared/ui/atoms/input";
import { Button } from "@/shared/ui/atoms/button";
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar";
import { 
    MessageSquare, 
    ChevronRight, 
    Send, 
    Lock,
    User,
    MessagesSquare
} from "lucide-react";
import { TICKET_THEME } from "../../ticket.theme";
import type { Ticket } from "../types";
import { useUnifiedTicketMessage } from "../../hooks/useUnifiedTicketMessage";
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider";
import { useTicketContext } from "../../context/TicketContext";
import { toast } from "sonner";
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export function TicketChatPanel({ ticket, readOnly = false, onCloseChat }: { ticket: Ticket; readOnly?: boolean; onCloseChat: () => void }) {
    const { user } = useAuth();
    const [inputValue, setInputValue] = useState("");
    const { getChatForTicket } = useTicketContext();
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const loadChat = async () => {
            if (!ticket.id) return;
            const chat = await getChatForTicket(ticket.id);
            if (chat) setCurrentChatId(chat.id);
        };
        loadChat();
    }, [ticket.id, getChatForTicket]);

    const { messages, sendMessage, isLoading } = useUnifiedTicketMessage(currentChatId || undefined);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;
        if (!currentChatId) {
            toast.error("Le chat n'est pas encore initialisé.");
            return;
        }
        await sendMessage(inputValue);
        setInputValue("");
    };

    return (
        <div className={`flex flex-col h-full ${TICKET_THEME.page.background}`}>
            
            {/* Header */}
            <div className={`px-6 py-5 flex items-center justify-between border-b ${TICKET_THEME.bar.container} sticky top-0 z-10 bg-inherit/95 backdrop-blur-md`}>
                <div className="flex flex-col space-y-0.5">
                    <span className={`text-sm font-black flex items-center gap-2 tracking-tight ${TICKET_THEME.page.text}`}>
                        <MessagesSquare size={18} className="text-emerald-500"/>
                        CONVERSATION
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.15em] opacity-70">
                        {readOnly ? "Lecture Seule" : "Support Client"}
                    </span>
                </div>
                
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onCloseChat} 
                    className={`${TICKET_THEME.button.ghost} rounded-full`}
                >
                    <ChevronRight size={20} />
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1">
                <div className="p-6 space-y-8">
                    {messages.length === 0 && !isLoading && (
                        <EmptyState
                            icon={MessageSquare}
                            variant="search"
                            title="Aucun échange"
                            description="Démarrez la discussion avec le demandeur."
                        />
                    )}

                    {messages.map((msg, index) => {
                        const isMe = msg.send_by === user?.user_id;
                        return (
                            <div key={msg.id || index} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-3 duration-slow ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Avatar className="h-9 w-9 shrink-0 border-2 border-white dark:border-slate-800 shadow-sm self-end">
                                    <AvatarFallback className={`text-[10px] font-black ${isMe ? 'bg-success text-success-foreground' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                        {isMe ? <User size={14} strokeWidth={3}/> : (msg.send_profile?.full_name?.[0] || 'U')}
                                    </AvatarFallback>
                                </Avatar>
                                
                                <div className={`flex flex-col gap-1.5 max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-4 py-3 rounded-2xl text-[13px] shadow-sm leading-snug tracking-tight ${
                                        isMe 
                                        ? `${TICKET_THEME.chat.bubbleMe} rounded-br-none font-medium` 
                                        : `${TICKET_THEME.chat.bubbleOthers} rounded-bl-none`
                                    }`}>
                                        {msg.content}
                                    </div>
                                    <div className="flex items-center gap-2 px-1">
                                        <span className="text-[9px] font-bold text-slate-400 opacity-80">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Input Footer */}
            <div className="mt-auto">
                {readOnly ? (
                    <div className={`p-6 border-t ${TICKET_THEME.bar.container} bg-slate-50/50 dark:bg-slate-900/30`}>
                        <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <Lock size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Discussion EN VUE SEULE
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className={`p-5 border-t ${TICKET_THEME.bar.container} bg-white dark:bg-slate-950`}>
                        <div className={`flex gap-2 items-end p-2 rounded-2xl border-2 transition-colors duration-base ${TICKET_THEME.input.base} focus-within:border-emerald-500/50 shadow-inner`}>
                            <Input 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Répondre au ticket..." 
                                className={`bg-transparent border-0 focus-visible:ring-0 text-[13px] font-medium py-2 min-h-[44px] ${TICKET_THEME.input.text}`} 
                            />
                            <Button 
                                onClick={handleSend} 
                                size="icon" 
                                disabled={!inputValue.trim() || !currentChatId}
                                className={`${TICKET_THEME.button.primary} h-10 w-10 rounded-xl shrink-0 transition-transform active:scale-95`}
                            >
                                <Send size={18} />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}