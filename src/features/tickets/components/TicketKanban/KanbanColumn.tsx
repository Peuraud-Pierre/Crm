import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/shared/ui/atoms/badge";
import { Button } from "@/shared/ui/atoms/button";
import { ScrollArea, ScrollBar } from "@/shared/ui/atoms/scroll-area";
import { MoreHorizontal, Plus } from "lucide-react";
import type { Ticket } from "../types";
import { TICKET_THEME } from "../../ticket.theme";
import { DraggableTicketCard } from "../Ticket/DraggableTicketCard";


interface KanbanColumnProps {
  id: string;
  label: string;
  count: number;
  tickets: Ticket[];
  config: { barColor: string; countBadge: string };
  onTicketClick: (ticket: Ticket) => void;
}

export function KanbanColumn({ id, label, count, tickets, config, onTicketClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      // RESPONSIVE : Largeur flexible sur mobile, fixe sur desktop
      className={`flex h-full w-[85vw] max-w-[340px] sm:w-[320px] shrink-0 flex-col rounded-lg shadow-sm border overflow-hidden transition-colors ${TICKET_THEME.kanban.column.bg} ${isOver ? "ring-2 ring-blue-200 border-blue-400" : TICKET_THEME.kanban.column.border}`}
    >
      <div className={`h-1.5 w-full ${config.barColor}`} />

      <div className={`flex items-center justify-between px-4 py-3 border-b ${TICKET_THEME.kanban.column.headerBorder}`}>
        <div className="flex items-center gap-3">
          <h3 className={`text-sm font-bold ${TICKET_THEME.kanban.column.title}`}>{label}</h3>
          <Badge variant="secondary" className={`rounded-full px-2.5 py-0.5 text-xs font-bold border-none min-w-[24px] justify-center ${config.countBadge}`}>
            {count}
          </Badge>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className={`h-8 w-8 ${TICKET_THEME.button.ghost}`}><Plus size={16} /></Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 ${TICKET_THEME.button.ghost}`}><MoreHorizontal size={16} /></Button>
        </div>
      </div>

      {/* THROTTLE : Limitation de la hauteur ici */}
      {/* max-h-[65vh] assure qu'on voit environ 4-5 tickets, ensuite ça scroll */}
      <ScrollArea className={`flex-1 p-2 sm:p-3 ${TICKET_THEME.kanban.column.scrollArea} min-h-[55vh] max-h-[65vh]`}>
        <div className="flex flex-col gap-3 min-h-[50px]">
          {tickets.map((ticket) => (
            <DraggableTicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
          ))}
          {tickets.length === 0 && (
            <div className={`flex h-40 items-center justify-center text-sm font-medium italic ${TICKET_THEME.kanban.emptyState.text}`}>
              Vide
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}