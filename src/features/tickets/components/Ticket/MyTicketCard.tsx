import { CheckCircle2, Archive, Clock, MessageSquare, ChevronRight } from "lucide-react";
import { TICKET_THEME } from "../../ticket.theme";
import type { Ticket } from "../types";
import { formatDate } from "../../ticket.helper";
import { Badge } from "@/shared/ui/atoms/badge";



interface MyTicketCardProps {
    ticket: Ticket;
    onClick: () => void;
}

export function MyTicketCard({ ticket, onClick }: MyTicketCardProps) {
    const isResolved = ticket.status === "résolu";
    const isClosed = ticket.status === "clos";
    const StatusIcon = isResolved ? CheckCircle2 : (isClosed ? Archive : Clock);
    const statusColorClass = isResolved ? "text-emerald-500" : (isClosed ? "text-slate-400" : "text-blue-500");

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            className={`
                group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 
                bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 
                rounded-xl shadow-sm hover:shadow-md hover:border-emerald-500/30 dark:hover:border-emerald-500/30 
                transition-[box-shadow,border-color] cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
            `}
        >
            {/* Barre latérale de statut */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${TICKET_THEME.colors.dot[ticket.status as keyof typeof TICKET_THEME.colors.dot] || "bg-slate-300"}`} />

            {/* ID & Date (Mobile top view) */}
            <div className="flex sm:hidden justify-between w-full text-[10px] text-slate-400 font-mono mb-1 pl-2 uppercase tracking-wide">
                <span>#{ticket.id?.toString().slice(-4)}</span>
                <span>{formatDate(ticket.created_at)}</span>
            </div>

            {/* Icone Status */}
            <div className="hidden sm:flex items-center justify-center h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 shrink-0 ml-2 border border-slate-100 dark:border-slate-800">
                <StatusIcon size={18} className={statusColorClass} />
            </div>

            {/* Contenu Principal */}
            <div className="flex-1 min-w-0 pl-2 sm:pl-0 space-y-1.5 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-sm font-bold truncate pr-4 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${TICKET_THEME.page.text}`}>
                        {ticket.title}
                    </h3>
                    <Badge
                        variant="outline"
                        className={`h-5 text-[9px] uppercase border rounded-md font-bold tracking-wider ${TICKET_THEME.colors.statusBadge[ticket.status as keyof typeof TICKET_THEME.colors.statusBadge]}`}
                    >
                        {ticket.status?.replace("_", " ")}
                    </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {ticket.description}
                </p>
            </div>

            {/* Meta Data Desktop */}
            <div className="hidden sm:flex flex-col items-end gap-1.5 text-right pl-6 border-l border-slate-100 dark:border-slate-800 min-w-[120px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {formatDate(ticket.created_at).split(" ")[0]} {formatDate(ticket.created_at).split(" ")[1]}
                </span>
                {ticket.assigned_to ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                        <MessageSquare size={10} />
                        <span>Pris en charge</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        <span>En attente</span>
                    </div>
                )}
            </div>

            {/* Chevron Mobile */}
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 sm:hidden" size={20} />
        </div>
    );
}