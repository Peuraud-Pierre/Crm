import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/shared/ui/organisms/command"
import { cn } from "@/shared/lib/utils"
import type { Client } from "@/features/crm/types"
import { useClientSearch } from "@/features/crm/hooks/data/useClientSearch"

interface TaskClientPickerProps {
    /** Stock commun (CRMContext) : sert à afficher le nom du client choisi. */
    clients: Client[] | null | undefined
    clientId: string
    onChange: (clientId: string | null) => void
}

/**
 * Sélecteur de client (optionnel) pour une tâche — combobox avec recherche.
 * Partagé entre les dialogs de création et d'édition de TaskModals.tsx (le
 * même panneau était dupliqué entre les deux, cf. TaskItem.tsx pour le
 * pendant "owner" côté affichage).
 */
export function TaskClientPicker({
    clients,
    clientId,
    onChange,
}: TaskClientPickerProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    // Recherche serveur sur toute la table (et non les seuls clients chargés).
    const results = useClientSearch(search, 50)

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-secondary-foreground">
                Client (optionnel)
            </label>
            <Popover open={open} onOpenChange={setOpen} modal={true}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-9 text-sm px-3 font-normal",
                            !clientId && "text-muted-foreground"
                        )}
                    >
                        <span className="truncate text-left flex-1 min-w-0">
                            {clients?.find((c) => c.id === clientId)?.nom ||
                                "Aucun client"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {/* shouldFilter={false} : le serveur a déjà filtré (y compris
                        téléphone/mail/société, que le filtre local sur le nom
                        masquerait). */}
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Rechercher un client..."
                            value={search}
                            onValueChange={setSearch}
                            className="h-9 text-sm"
                        />
                        <CommandList
                            className="overflow-y-auto"
                            style={{ maxHeight: 240 }}
                        >
                            <CommandGroup>
                                <CommandItem
                                    value=""
                                    onSelect={() => {
                                        onChange(null)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "h-3.5 w-3.5 shrink-0 text-primary",
                                            !clientId
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate flex-1 min-w-0 text-muted-foreground">
                                        Aucun client
                                    </span>
                                </CommandItem>
                                {results.map((c) => (
                                    <CommandItem
                                        key={c.id}
                                        value={c.nom || ""}
                                        onSelect={() => {
                                            onChange(
                                                c.id === clientId
                                                    ? null
                                                    : (c.id ?? null)
                                            )
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "h-3.5 w-3.5 shrink-0 text-primary",
                                                clientId === c.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                        <span className="truncate flex-1 min-w-0">
                                            {c.nom}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
