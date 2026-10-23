import { useMemo, useState } from "react";
import { KanbanColumn } from "./KanbanColumn";
import { TicketDetailSheet } from "./TicketDetailSheet";
import { ScrollArea, ScrollBar } from "@/shared/ui/atoms/scroll-area";
import { useTicketContext } from "../../context/TicketContext"; // Assure-toi que le chemin est bon
import { TicketCard } from "../Ticket/TicketCard";
import { type DropAnimation, defaultDropAnimationSideEffects, useSensors, useSensor, PointerSensor, TouchSensor, type DragStartEvent, type DragEndEvent, DndContext, DragOverlay } from "@dnd-kit/core";
import { type Ticket, PRIORITY_COLUMNS_CONFIG, type TicketPriority } from "../types";


const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
};

export function TicketPriorityKanban() {
  // MODIFICATION : On récupère filteredTickets au lieu de tickets
  const { filteredTickets, updateTicket } = useTicketContext();
  
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor)
  );

  const ticketsByPriority = useMemo(() => {
    const groups: Record<string, Ticket[]> = {};
    PRIORITY_COLUMNS_CONFIG.forEach((col) => (groups[col.id] = []));
    
    // MODIFICATION : On itère sur les tickets FILTRÉS.
    // J'ai retiré le .filter(status !== 'clos') car c'est le FilterBar qui gère ça maintenant via le Context.
    filteredTickets.forEach((ticket) => {
      const priority = ticket.priority || "nouveau";
      if (groups[priority]) groups[priority].push(ticket);
      else groups["nouveau"].push(ticket);
    });
    
    return groups;
  }, [filteredTickets]); // Dépendance mise à jour

  const handleDragStart = (event: DragStartEvent) => {
    // On cherche dans filteredTickets
    const ticket = filteredTickets.find((t) => t.id?.toString() === event.active.id);
    if (ticket) setActiveTicket(ticket);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    
    // Si pas de changement ou drop hors zone
    if (!over || active.id === over.id) return;

    const ticketId = active.id as string;
    const newPriority = over.id as TicketPriority;
    
    // On trouve le ticket concerné
    const ticket = filteredTickets.find((t) => t.id?.toString() === ticketId);
    
    // Si le ticket existe et que la priorité a changé
    if (ticket && ticket.priority !== newPriority) {
      
      // 1. On crée une copie mise à jour du ticket
      const updatedTicket = { ...ticket, priority: newPriority };

      // 2. On appelle l'update du contexte
      // Le contexte doit gérer l'optimistic update sur 'tickets' global
      updateTicket(updatedTicket);
    }
  };

  return (
    <div className={`h-full w-full p-2 sm:p-4 overflow-hidden transition-colors`}>
      <TicketDetailSheet ticket={selectedTicket} open={!!selectedTicket} onClose={() => setSelectedTicket(null)} />
      
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* RESPONSIVE : ScrollArea gère le débordement horizontal */}
        <ScrollArea className="h-full w-full rounded-md">
          <div className="flex h-full gap-4 pb-4 snap-x snap-mandatory sm:snap-none px-[7.5vw] sm:px-0 sm:justify-center sm:mx-auto sm:w-fit">
            {PRIORITY_COLUMNS_CONFIG.map((col) => (
              <div key={col.id} className="snap-center"> {/* Snap center pour mobile */}
                <KanbanColumn
                  id={col.id}
                  label={col.label}
                  config={{ barColor: col.barColor, countBadge: col.countBadge }}
                  tickets={ticketsByPriority[col.id]}
                  count={ticketsByPriority[col.id].length}
                  onTicketClick={setSelectedTicket}
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTicket ? (
            <div className="rotate-2 cursor-grabbing scale-105 opacity-90 w-[320px]">
                <TicketCard ticket={activeTicket} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}