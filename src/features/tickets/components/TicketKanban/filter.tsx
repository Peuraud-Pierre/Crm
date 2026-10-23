import React from "react";
import {
  Search, X, ListFilter, Tags, ArrowUpDown, CheckCircle2, CircleDashed, Timer, XCircle,
  Bug, Sparkles, MessageSquare, FileText, User, Users
} from "lucide-react";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select";
import { useTicketContext } from "../../context/TicketContext";
import type { TicketCategory, TicketStatus, SortOption } from "../types";
import { Separator } from "@/shared/ui/atoms/separator";

// Icons (Directement utilisables)
const StatusIcons: Record<string, React.ReactNode> = {
  ouvert: <CircleDashed className="h-3.5 w-3.5 text-green-500" />,
  en_cours: <Timer className="h-3.5 w-3.5 text-blue-500" />,
  resolu: <CheckCircle2 className="h-3.5 w-3.5 text-purple-500" />,
  clos: <XCircle className="h-3.5 w-3.5 text-slate-500" />,
};
const CategoryIcons: Record<string, React.ReactNode> = {
  bug: <Bug className="h-3.5 w-3.5 text-red-500" />,
  amelioration: <Sparkles className="h-3.5 w-3.5 text-purple-500" />,
  feedback: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
  autre: <FileText className="h-3.5 w-3.5 text-slate-500" />,
};

export function TicketFilterBar() {
  const { filters, techUsers, setSearch, setCategory, setStatus, setAssignee, setSort, resetFilters } = useTicketContext();

  if (!filters) return null;
  const isFiltered = filters.search !== "" || filters.category !== "all" || filters.status !== "all" || filters.assignee !== "all";

  // Helper de style
  const getSelectTriggerClass = (isActive: boolean) => `
    h-8 text-xs font-medium px-3 shadow-sm transition-colors
    flex items-center justify-between gap-2
    focus:ring-0 focus:ring-offset-0 focus:outline-none outline-none
    ${isActive 
      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-800/50' 
      : 'bg-transparent border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200' 
    }
  `;

  return (
    <div className="flex flex-col sm:flex-row rounded-lg items-stretch sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 border-b bg-card/80 dark:bg-slate-900 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      
      {/* 1. RECHERCHE */}
      <div className="relative w-full sm:w-64 sm:shrink-0 group">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-green-500 transition-colors" />
        <Input
          placeholder="Rechercher un ticket..."
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 text-sm bg-slate-50/50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:border-green-500 transition-[box-shadow,border-color] rounded-lg"
        />
      </div>

      {/* 2. GROUPE DE FILTRES */}
      <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
        
        {/* RESPONSABLE */}
        <Select value={filters.assignee} onValueChange={setAssignee}>
            <SelectTrigger className={`w-fit min-w-[140px] ${getSelectTriggerClass(filters.assignee !== 'all')}`}>
                <div className="flex items-center gap-2 truncate">
                    <Users size={14} className={filters.assignee !== 'all' ? 'text-green-600' : 'text-slate-500'} />
                    <span className="truncate">
                        {filters.assignee === 'all' ? 'Responsable' : 
                         filters.assignee === 'mine' ? 'Mes tickets' : 
                         techUsers.find(u => u.id === filters.assignee)?.name || 'Utilisateur'}
                    </span>
                </div>
            </SelectTrigger>
            <SelectContent align="end" className="w-[220px]">
                <SelectItem value="all" className="text-xs font-medium">
                    <span className="flex items-center gap-2">Tous les tickets</span>
                </SelectItem>
                <SelectItem value="mine" className="text-xs font-medium text-green-600">
                    <span className="flex items-center gap-2"><User size={14}/> Mes tickets</span>
                </SelectItem>
                
                {techUsers.length > 0 && <div className="h-px bg-slate-100 my-1 mx-2" />}
                {techUsers.length > 0 && (
                    <div className="px-2 py-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Service Tech
                    </div>
                )}
                {/* Ajout de index à la key pour éviter l'erreur duplicate key en attendant le fix serveur */}
                {techUsers.map((tech, idx) => (
                    <SelectItem
                        // eslint-disable-next-line react-x/no-array-index-key
                        key={`${tech.id}-${idx}`}
                        value={tech.id}
                        className="text-xs pl-4"
                    >
                        <span className="flex items-center gap-2">{tech.name}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>

        {/* STATUT */}
        <Select value={filters.status} onValueChange={(v) => setStatus(v as TicketStatus | "all")}>
          <SelectTrigger className={`w-fit min-w-[110px] ${getSelectTriggerClass(filters.status !== 'all')}`}>
             <div className="flex items-center gap-2 truncate">
                <ListFilter size={14} className={filters.status !== 'all' ? 'text-blue-600' : 'text-slate-500'} />
                <span>{filters.status === 'all' ? 'Statut' : filters.status.charAt(0).toUpperCase() + filters.status.slice(1).replace('_', ' ')}</span>
             </div>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all" className="text-xs">
                <span className="flex items-center gap-2">Tout</span>
            </SelectItem>
            <SelectItem value="ouvert" className="text-xs">
                <span className="flex items-center gap-2">{StatusIcons.ouvert} Ouvert</span>
            </SelectItem>
            <SelectItem value="en_cours" className="text-xs">
                <span className="flex items-center gap-2">{StatusIcons.en_cours} En cours</span>
            </SelectItem>
            <SelectItem value="résolu" className="text-xs">
                <span className="flex items-center gap-2">{StatusIcons.resolu} Résolu</span>
            </SelectItem>
            <SelectItem value="clos" className="text-xs">
                <span className="flex items-center gap-2">{StatusIcons.clos} Clos</span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* CATEGORIE */}
        <Select value={filters.category} onValueChange={(v) => setCategory(v as TicketCategory | "all")}>
          <SelectTrigger className={`w-fit min-w-[120px] ${getSelectTriggerClass(filters.category !== 'all')}`}>
             <div className="flex items-center gap-2 truncate">
                <Tags size={14} className={filters.category !== 'all' ? 'text-blue-600' : 'text-slate-500'} />
                <span>{filters.category === 'all' ? 'Catégorie' : filters.category.charAt(0).toUpperCase() + filters.category.slice(1)}</span>
             </div>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all" className="text-xs">
                <span className="flex items-center gap-2">Toutes</span>
            </SelectItem>
            <SelectItem value="bug" className="text-xs">
                <span className="flex items-center gap-2">{CategoryIcons.bug} Bug</span>
            </SelectItem>
            <SelectItem value="amelioration" className="text-xs">
                <span className="flex items-center gap-2">{CategoryIcons.amelioration} Amélioration</span>
            </SelectItem>
            <SelectItem value="feedback" className="text-xs">
                <span className="flex items-center gap-2">{CategoryIcons.feedback} Feedback</span>
            </SelectItem>
            <SelectItem value="autre" className="text-xs">
                <span className="flex items-center gap-2">{CategoryIcons.autre} Autre</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Separator className="h-5 w-px bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block" />

        {/* TRI */}
        <Select value={filters.sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="h-8 w-fit text-xs font-medium border-transparent bg-transparent hover:bg-slate-100 text-slate-600 px-2 shadow-none focus:ring-0 focus:outline-none">
            <div className="flex items-center gap-1.5">
                <ArrowUpDown size={14} />
                <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="newest" className="text-xs">
                <span className="flex items-center gap-2">Plus récents</span>
            </SelectItem>
            <SelectItem value="oldest" className="text-xs">
                <span className="flex items-center gap-2">Plus anciens</span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* RESET */}
        {isFiltered && (
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters} 
                className="h-8 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" 
                title="Réinitialiser"
            >
                <X size={16} />
            </Button>
        )}
      </div>
    </div>
  );
}