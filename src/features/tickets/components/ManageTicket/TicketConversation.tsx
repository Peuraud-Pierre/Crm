import { Send, Paperclip, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/ui/atoms/button";
import { ScrollArea } from "@/shared/ui/atoms/scroll-area";
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar";
import { TICKET_THEME } from "../../ticket.theme";

// Composant Interne : Ticket Original
function TicketOriginalCard({
  ticket,
}: {
  ticket: { title: string; desc: string };
}) {
  return (
    <div className="mb-8">
        <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink-0 mx-4 text-xs text-slate-400 font-medium uppercase tracking-wider">Ticket Original</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
            <h3 className="font-bold text-lg mb-2">{ticket.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {ticket.desc}
            </p>
            <div className="mt-4 flex gap-2">
                {/* Badges Tags ici */}
            </div>
        </div>
    </div>
  );
}

export function TicketConversation({ ticketId }: { ticketId: string }) {
  // MOCK — ticketId sera utilisé pour charger la vraie conversation.
  void ticketId;
  const ticket = { title: "Problème VPN", desc: "Impossible de me connecter...", user: "Alice" };
  const messages = [
    { id: 1, text: "Bonjour, avez-vous essayé de rebooter ?", sender: "me" },
    { id: 2, text: "Oui, sans succès.", sender: "other" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header Simple */}
      <header className="h-14 border-b flex items-center justify-between px-6 bg-card dark:bg-slate-950">
        <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{ticket.title}</span>
            <span className="text-slate-400 text-xs">• {ticket.user}</span>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-2 border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
            <CheckCircle2 size={14} /> Clore
        </Button>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
            <TicketOriginalCard ticket={ticket} />
            
            <div className="space-y-6">
                {messages.map((m) => (
                    <div key={m.id} className={`flex gap-3 ${m.sender === 'me' ? 'flex-row-reverse' : ''}`}>
                        <Avatar className="h-8 w-8 mt-1">
                            <AvatarFallback className="text-xs">{m.sender === 'me' ? 'Moi' : 'A'}</AvatarFallback>
                        </Avatar>
                        <div className={`
                            px-4 py-2.5 rounded-2xl text-sm max-w-[80%]
                            ${m.sender === 'me' 
                                ? 'bg-foreground text-background rounded-tr-none' 
                                : 'bg-card border border-border text-card-foreground rounded-tl-none shadow-sm'
                            }
                        `}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </ScrollArea>

      {/* Input Zone */}
      <div className="p-4 border-t bg-card dark:bg-slate-950">
        <div className="max-w-3xl mx-auto flex gap-2">
            <Button variant="ghost" size="icon" className="text-slate-400"><Paperclip size={18}/></Button>
            <input 
                className="flex-1 bg-slate-50 dark:bg-slate-900 border-0 rounded-lg px-4 text-sm focus:ring-1 focus:ring-blue-500"
                placeholder="Répondre..."
            />
            <Button size="icon" className={TICKET_THEME.button.primary}><Send size={16}/></Button>
        </div>
      </div>
    </div>
  );
}