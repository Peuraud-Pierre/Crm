import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/shared/ui/atoms/card";
import { User, Clock, AlertCircle } from "lucide-react"; // On garde uniquement les icones génériques
import { Badge } from "@/shared/ui/atoms/badge";
import type { Ticket } from "../types";
import { formatDate, CategoryIcon } from "../../ticket.helper"; // Import groupé
import { TICKET_THEME } from "../../ticket.theme";

export function TicketCard({ ticket }: { ticket: Ticket }) {
  // 1. Détermination de la priorité
  const priority = ticket.priority || 'nouveau';
  
  // 2. Application du thème
  const cardThemes = TICKET_THEME.card as Record<
    string,
    (typeof TICKET_THEME.card)["moyenne"]
  >;
  const theme = cardThemes[priority] || TICKET_THEME.card.moyenne;

  const displayId = ticket.id ? ticket.id.toString().slice(-4) : "----";

  return (
    <Card
      variant="interactive"
      className={`group relative w-full border-l-4 ${theme.bg} ${theme.border}`}
    >
      
      {/* --- HEADER --- */}
      <CardHeader className="p-3 pb-1 flex flex-row justify-between items-start space-y-0">
        <div className="flex flex-col gap-0.5 max-w-[85%]">
           <CardTitle className={`text-sm font-bold leading-tight line-clamp-2 ${theme.text}`}>
             {ticket.title}
           </CardTitle>
           <span className={`text-[10px] font-mono ${theme.mutedText}`}>
             #{displayId}
           </span>
        </div>
        
        {/* Utilisation du Helper importé */}
        <div className="shrink-0">
            <CategoryIcon category={ticket.category} />
        </div>
      </CardHeader>

      {/* --- CONTENT --- */}
      <CardContent className="p-3 pt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1">
           {ticket.description ? (
             <span className={`text-xs leading-snug line-clamp-2 ${theme.mutedText}`}>
               {ticket.description.length > 20 
                  ? `${ticket.description.slice(0, 20)}...` 
                  : ticket.description}
             </span>
           ) : (
             <div className="flex items-center gap-1">
               <AlertCircle size={12} className={theme.icon} />
               <span className={`text-xs italic ${theme.mutedText}`}>Aucune description</span>
             </div>
           )}
        </div>

        <Badge variant="outline" className={`shrink-0 rounded-[4px] px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}>
          {ticket.from || "APP"}
        </Badge>
      </CardContent>

      {/* --- FOOTER --- */}
      <CardFooter className={`flex items-center justify-between p-3 pt-2 border-t ${theme.footerBorder}`}>
        <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${theme.timerBg}`}>
          <Clock size={11} className="opacity-70" />
          <span className="text-[10px] font-mono font-medium">{formatDate(ticket.created_at)}</span>
        </div>

        <div>
            {ticket.profiles?.full_name ? (
               <div className={`flex h-6 w-6 items-center justify-center rounded-full border shadow-sm ${theme.avatarBg}`}>
                  <span className="text-[10px] font-bold">
                    {ticket.profiles.full_name[0].toUpperCase()}
                  </span>
               </div>
            ) : (
              <User size={14} className={theme.icon} />
            )}
        </div>
      </CardFooter>
    </Card>
  );
}