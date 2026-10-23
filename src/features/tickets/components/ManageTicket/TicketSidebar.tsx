import { useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/shared/ui/atoms/input";
import { Button } from "@/shared/ui/atoms/button";
import { ScrollArea } from "@/shared/ui/atoms/scroll-area";
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar";
import { Badge } from "@/shared/ui/atoms/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger
} from "@/shared/ui/atoms/dropdown-menu";
import { TICKET_THEME } from "../../ticket.theme";

// MOCK TEMPORAIRE
const MOCK_TICKETS = [
  { id: "1", title: "VPN HS", user: "Alice", time: "10:30", prio: "haute" },
  { id: "2", title: "Licence Adobe", user: "Bob", time: "Hier", prio: "moyenne" },
];

interface TicketListSidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TicketListSidebar({ selectedId, onSelect }: TicketListSidebarProps) {
  const [sort, setSort] = useState("date-desc");

  return (
    <div className="flex flex-col h-full">
      {/* Header Filtres */}
      <div className="p-4 border-b space-y-3 bg-card dark:bg-slate-950/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Mes Tickets</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowUpDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
                <DropdownMenuRadioItem value="date-desc">Plus récents</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="prio-desc">Priorité haute</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Rechercher..." className="pl-9 h-9 text-sm" />
        </div>
      </div>

      {/* Liste */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {MOCK_TICKETS.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`
                w-full text-left p-3 rounded-lg border transition-[color,background-color,border-color,box-shadow] text-sm
                flex flex-col gap-2
                ${selectedId === t.id 
                  ? "bg-card dark:bg-slate-900 border-blue-500/30 ring-1 ring-blue-500/20 shadow-sm" 
                  : "border-transparent hover:bg-card/50 dark:hover:bg-slate-900/50"
                }
              `}
            >
              <div className="flex justify-between w-full">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{t.user[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate">{t.user}</span>
                </div>
                <span className="text-[10px] text-slate-400">{t.time}</span>
              </div>
              <div className="font-semibold truncate text-slate-700 dark:text-slate-200">
                {t.title}
              </div>
              <div className="flex gap-2 mt-1">
                 <Badge variant="outline" className={`text-[9px] px-1.5 h-4 border-0 ${TICKET_THEME.colors.priority[t.prio as keyof typeof TICKET_THEME.colors.priority]}`}>
                    {t.prio}
                 </Badge>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}