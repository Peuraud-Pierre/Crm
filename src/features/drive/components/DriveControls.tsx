import { Info, LayoutGrid, List, Search } from "lucide-react"

import { Button } from "@/shared/ui/atoms/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/atoms/toggle-group"

import {
    SORT_KEYS,
    SORT_LABELS,
    type SortKey,
} from "@/features/drive/utils/sortItems"

export type DriveView = "grid" | "list"

/** Recherche, tri, mode d'affichage et aide du Drive. */
export default function DriveControls({
    query,
    onQueryChange,
    sort,
    onSortChange,
    view,
    onViewChange,
}: {
    query: string
    onQueryChange: (value: string) => void
    sort: SortKey
    onSortChange: (sort: SortKey) => void
    view: DriveView
    onViewChange: (view: DriveView) => void
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher…"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    className="pl-8"
                    aria-label="Rechercher dans ce dossier"
                />
            </div>

            <Select
                value={sort}
                onValueChange={(v) => onSortChange(v as SortKey)}
            >
                <SelectTrigger className="w-[11rem]" aria-label="Trier">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {SORT_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                            {SORT_LABELS[key]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => v && onViewChange(v as DriveView)}
            >
                <ToggleGroupItem value="grid" aria-label="Vue grille">
                    <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Vue liste">
                    <List className="h-4 w-4" />
                </ToggleGroupItem>
            </ToggleGroup>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Info className="h-4 w-4" /> Aide
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="w-80 text-sm leading-relaxed"
                >
                    <p className="p-2">
                        Survolez un élément pour le sélectionner. Glissez-le sur
                        un dossier — ou sur un maillon du fil d'Ariane — pour le
                        déplacer. Déposez des fichiers depuis votre bureau pour
                        les envoyer dans le dossier courant.
                    </p>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
