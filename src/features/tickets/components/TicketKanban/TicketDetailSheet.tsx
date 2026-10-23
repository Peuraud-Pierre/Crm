import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/shared/ui/atoms/sheet";
import { useTicketContext } from "../../context/TicketContext";
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider";
import { TicketInfoPanel } from "./TicketInfoPanel";
import { TicketChatPanel } from "./TicketChatPanel";
import type { Ticket } from "../types";

interface TicketDetailSheetProps {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
}

export function TicketDetailSheet({ ticket: initialTicket, open, onClose }: TicketDetailSheetProps) {
  const { tickets } = useTicketContext();
  const { user } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    // Reset contrôlé du panneau chat quand on change de ticket.
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsChatOpen(false);
  }, [initialTicket?.id]);

  if (!initialTicket) return null;

  const liveTicket = tickets.find(t => t.id === initialTicket.id) || initialTicket;
  const isAssignedToMe = user && liveTicket.assigned_to === user.user_id;
  const isTicketClosed = liveTicket.status === 'clos' || liveTicket.status === 'résolu';
  const isCreatedByMe = user && liveTicket.created_by === user.user_id;
  const isChatReadOnly = isTicketClosed || (!isAssignedToMe && !isCreatedByMe);

  // --- CONFIGURATION DES TAILLES ---
  // Chat réduit à 450px pour un look plus "messagerie" et moins "bloc"
  const CHAT_WIDTH_DESKTOP = "lg:w-[450px]";
  const INFO_WIDTH_DESKTOP = "lg:w-[400px]";

  // Largeur du sheet : 400px (Info seule) ou 850px (Info + Chat)
  const sheetMaxWidthClass = isChatOpen ? "lg:max-w-[850px]" : "lg:max-w-[400px]";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        className={`
          ${sheetMaxWidthClass} w-full p-0 
          bg-white dark:bg-slate-950 border-l dark:border-slate-800 
          shadow-2xl transition-[max-width] duration-slower ease-in-out
          overflow-hidden
        `}
      >
        <div className="flex flex-row-reverse h-full w-full relative">
          
          {/* === PANNEAU INFOS (Toujours visible au premier plan sur PC) === */}
          <div
            className={`
              h-full w-full ${INFO_WIDTH_DESKTOP}
              flex-shrink-0 z-10 bg-white dark:bg-slate-950
              /* Pas de bordure sur PC car le chat est à gauche */
              lg:border-l-0
            `}
          >
            <TicketInfoPanel
              ticket={liveTicket}
              isChatOpen={isChatOpen}
              onToggleChat={() => setIsChatOpen(!isChatOpen)}
              onCloseSheet={onClose}
            />
          </div>

          {/* === PANNEAU CHAT === */}
          <div
            className={`
              /* MOBILE : Superposition absolue */
              absolute inset-0 z-20 transition-[transform,opacity,width] duration-slower ease-in-out
              
              /* PC : On réintègre le flux pour qu'il pousse l'info panel */
              lg:relative lg:inset-auto lg:z-0
              
              ${CHAT_WIDTH_DESKTOP}
              bg-slate-50 dark:bg-slate-900/50
              
              ${isChatOpen 
                ? "translate-x-0 opacity-100" 
                : "translate-x-full lg:translate-x-0 lg:w-0 opacity-0 overflow-hidden"
              }
            `}
          >
            {/* Conteneur pour verrouiller la largeur sur desktop et éviter les sauts d'UI */}
            <div className="w-full lg:w-[450px] h-full border-r dark:border-slate-800">
              {isChatOpen && (
                <TicketChatPanel
                  ticket={liveTicket}
                  readOnly={isChatReadOnly}
                  onCloseChat={() => setIsChatOpen(false)}
                />
              )}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}