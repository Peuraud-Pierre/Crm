import React from "react"
import { Card } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    FileText,
    Euro,
    Send,
    Search,
    Plus,
    User,
    FilterX,
    LayoutList,
    ArrowUpDown,
    Layers,
} from "lucide-react"

import { useQuotesFiltersLogic } from "./Quotes/Quotelogic"
import { StatTile } from "@/shared/components/misc/StatTile"

export const QuotesFiltersAndStats: React.FC = () => {
    const logic = useQuotesFiltersLogic()

    // Liste des créateurs de devis issue de la recherche globale.
    const usersList = logic.search

    return (
        <div className="space-y-6">
            {/* --- Section KPI (Modifiée pour 3 colonnes) --- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatTile
                    index={0}
                    label="Total de bons"
                    value={logic.stats.count}
                    icon={FileText}
                />
                <StatTile
                    index={1}
                    label="Valeur Totale"
                    value={`${(logic.stats.totalValue / 1000).toFixed(1)} k€`}
                    icon={Euro}
                />
                <StatTile
                    index={2}
                    label="Valeur Envoyée"
                    // On utilise logic.stats.sentValue (assurez-vous de l'ajouter dans votre hook)
                    value={`${(logic.stats.sentValue / 1000).toFixed(1)} k€`}
                    icon={Send}
                    tone="success"
                />
            </div>

            {/* --- Section Toolbar Unifiée --- */}
            <Card className="border shadow-sm bg-card dark:bg-zinc-900 overflow-visible">
                <div className="p-3 flex flex-col md:flex-row gap-3 items-center">
                    {/* A. Recherche */}
                    <div className="relative w-full md:flex-1 min-w-[200px] dark:bg-zinc-900">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher..."
                            value={logic.searchTerm}
                            onChange={(e) =>
                                logic.setSearchTerm(e.target.value)
                            }
                            className="pl-9 transition-colors"
                        />
                    </div>

                    <div className="hidden md:block h-8 w-px bg-gray-200 dark:bg-gray-800 mx-1" />

                    {/* B. Zone de Filtres */}
                    <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
                        <Select
                            value={logic.statusFilter}
                            onValueChange={logic.setStatusFilter}
                        >
                            <SelectTrigger className="w-full md:w-[140px] border-dashed">
                                <div className="flex items-center gap-2 truncate">
                                    <LayoutList className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Statut" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Tous statuts
                                </SelectItem>
                                <SelectItem value="Brouillon">
                                    Brouillon
                                </SelectItem>
                                {/* 🎯 MODIFICATION ICI : value="envoyer" au lieu de "Envoyé" */}
                                <SelectItem value="envoyer">Envoyer</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={logic.currentUserValue}
                            onValueChange={logic.handleUserChange}
                        >
                            <SelectTrigger className="w-full md:w-[160px] border-dashed">
                                <div className="flex items-center gap-2 truncate">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Gestionnaire" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Mes Bons</SelectItem>
                                <SelectItem value="all">Tous</SelectItem>
                                <div className="h-px bg-muted my-1 mx-1" />
                                {usersList &&
                                    usersList
                                        .filter((u: { user_id?: string; id?: string; name?: string; full_name?: string }) => {
                                            const finalId = u.user_id || u.id
                                            return (
                                                finalId !== logic.user?.user_id
                                            )
                                        })
                                        .map((u: { user_id?: string; id?: string; name?: string; full_name?: string }) => {
                                            const finalId = u.user_id || u.id || ""
                                            return (
                                                <SelectItem
                                                    key={finalId}
                                                    value={finalId}
                                                >
                                                    {u.name || u.full_name}
                                                </SelectItem>
                                            )
                                        })}
                            </SelectContent>
                        </Select>

                        {logic.serviceOptions.length > 0 && (
                            <Select
                                value={logic.currentServiceValue || "default"}
                                onValueChange={(v) =>
                                    v !== "default" &&
                                    logic.setCombinedFilter(`service:${v}`)
                                }
                            >
                                <SelectTrigger className="w-full md:w-[140px] border-dashed">
                                    <div className="flex items-center gap-2 truncate">
                                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue placeholder="Service" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default" disabled>
                                        Choisir...
                                    </SelectItem>
                                    {logic.serviceOptions.map((s) => (
                                        <SelectItem key={`s-${s}`} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select
                            value={logic.sortBy}
                            onValueChange={logic.setSortBy}
                        >
                            <SelectTrigger className="w-full md:w-[130px] border-dashed bg-transparent">
                                <div className="flex items-center gap-2 truncate">
                                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="Trier" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="amount">Montant</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* C. Actions */}
                    <div className="flex items-center gap-2 w-full xl:w-auto border-l pl-0 xl:pl-3 border-none xl:border-solid border-gray-200">
                        {logic.hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={logic.clearFilters}
                                className="h-9 w-9 text-muted-foreground hover:text-red-500"
                                title="Effacer les filtres"
                            >
                                <FilterX className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            onClick={logic.handleCreateNew}
                            className="w-full md:w-auto bg-primary shadow-sm hover:shadow text-primary-foreground whitespace-nowrap"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Créer
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
