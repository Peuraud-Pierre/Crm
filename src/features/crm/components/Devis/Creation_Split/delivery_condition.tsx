import { useState } from "react"
import {
    Truck,
    FileText,
    MapPin,
    Receipt,
    Check,
    ChevronsUpDown,
    Plus,
    X,
    Store,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

// UI Components
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/ui/atoms/select"
import { Input } from "@/shared/ui/atoms/input"
import { Button } from "@/shared/ui/atoms/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/shared/ui/organisms/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"

// Contexts
import { useDevisContext } from "@/features/crm/context/DevisContext"

export default function DeliveryAndCondition() {
    const {
        Livraison,
        setLivraisonMethod,
        note,
        setNote,
        adresseLivraison,
        setAdresseLivraison,
        adresseFacturation,
        setAdresseFacturation,
        savedAddresses,
        addAddressToHistory,
        removeAddressFromHistory,
    } = useDevisContext()

    const [openDelivery, setOpenDelivery] = useState(false)
    const [searchDelivery, setSearchDelivery] = useState("")

    // --- 🪄 AUTO-SCROLL SUR FOCUS (FIX CLAVIER TABLETTE) ---
    const handleFocus = (e: React.SyntheticEvent) => {
        const target = e.currentTarget
        setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
    }

    const onSaveAddress = (address: string) => {
        addAddressToHistory(address)
        setOpenDelivery(false)
        setSearchDelivery("")
    }

    return (
        // Rendu responsive : 1 colonne sur mobile, 2 colonnes à partir de l'écran 'sm', padding réduit sur mobile
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 bg-card rounded-xl border shadow-sm">
            {/* --- 1. MODE DE LIVRAISON --- */}
            <div className="flex flex-col gap-2">
                <label className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Mode de livraison
                </label>
                <Select value={Livraison} onValueChange={setLivraisonMethod}>
                    <SelectTrigger
                        onFocus={handleFocus}
                        className="w-full h-10 bg-background border-input hover:bg-accent/50 transition-colors rounded-md px-3 flex items-center gap-2 focus:ring-2 focus:ring-ring"
                    >
                        {Livraison === "Livraison" ? (
                            <div className="flex items-center gap-2 truncate">
                                <Truck className="w-4 h-4 shrink-0 text-blue-600" />
                                <span className="truncate">
                                    Livraison sur site
                                </span>
                            </div>
                        ) : Livraison === "Emporter" ? (
                            <div className="flex items-center gap-2 truncate">
                                <Store className="w-4 h-4 shrink-0 text-orange-600" />
                                <span className="truncate">Retrait dépôt</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 truncate">
                                <Truck className="w-4 h-4 shrink-0 text-blue-600" />
                                <span className="truncate">Exworks</span>
                            </div>
                        )}
                    </SelectTrigger>

                    <SelectContent
                        position="popper"
                        className="z-50 min-w-[8rem] w-full max-w-[90vw] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
                    >
                        <SelectItem
                            value="Livraison"
                            className="cursor-pointer py-2"
                        >
                            <div className="flex items-center gap-2 px-1 sm:px-3">
                                <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="truncate">
                                    Livraison sur site
                                </span>
                            </div>
                        </SelectItem>
                        <SelectItem
                            value="Emporter"
                            className="cursor-pointer py-2"
                        >
                            <div className="flex items-center gap-2 px-1 sm:px-3">
                                <Store className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="truncate">
                                    Retrait dépôt (À emporter)
                                </span>
                            </div>
                        </SelectItem>
                        <SelectItem
                            value="Exworks"
                            className="cursor-pointer py-2"
                        >
                            <div className="flex items-center gap-2 px-1 sm:px-3">
                                <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="truncate">
                                    Exworks (Gestion Client)
                                </span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* --- 2. NOTE --- */}
            <div className="flex flex-col gap-2">
                <label className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Note
                </label>
                <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onFocus={handleFocus}
                        placeholder="Ex: 30% acompte..."
                        className="pl-9 h-10 w-full bg-background hover:bg-accent/50 transition-colors"
                    />
                </div>
            </div>

            {/* --- 3. ADRESSE LIVRAISON (Combobox) --- */}
            {Livraison !== "Emporter" && (
                <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>Adresse de livraison</span>
                        {adresseLivraison && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                                Validée
                            </span>
                        )}
                    </label>
                    <Popover open={openDelivery} onOpenChange={setOpenDelivery}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openDelivery}
                                onClick={handleFocus}
                                className={cn(
                                    "w-full justify-between h-10 px-3 font-normal bg-background hover:bg-accent/50 text-left transition-colors",
                                    !adresseLivraison && "text-muted-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                    <MapPin
                                        className={cn(
                                            "w-4 h-4 shrink-0",
                                            adresseLivraison
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        )}
                                    />
                                    <span className="truncate">
                                        {adresseLivraison ||
                                            "Sélectionner ou saisir une adresse..."}
                                    </span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent
                            // Correction critique pour mobile : on limite la largeur à l'écran (90vw) si le trigger est trop grand
                            className="w-full max-w-[90vw] md:w-[var(--radix-popover-trigger-width)] p-0"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <Command>
                                <CommandInput
                                    placeholder="Rechercher ou ajouter..."
                                    value={searchDelivery}
                                    onValueChange={setSearchDelivery}
                                />
                                <CommandList>
                                    <CommandEmpty className="p-2">
                                        <p className="text-xs text-muted-foreground mb-2 px-2 text-center">
                                            Aucune adresse trouvée.
                                        </p>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="w-full justify-start h-8 text-xs font-medium"
                                            onClick={() =>
                                                onSaveAddress(searchDelivery)
                                            }
                                        >
                                            <Plus className="mr-2 h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">
                                                Ajouter "{searchDelivery}"
                                            </span>
                                        </Button>
                                    </CommandEmpty>

                                    <CommandGroup heading="Carnet d'adresses">
                                        {savedAddresses.map((addr) => (
                                            <CommandItem
                                                key={addr.value}
                                                value={addr.value}
                                                onSelect={() => {
                                                    setAdresseLivraison(
                                                        addr.value
                                                    )
                                                    setOpenDelivery(false)
                                                }}
                                                className="group flex items-center justify-between py-2 cursor-pointer aria-selected:bg-accent gap-2"
                                            >
                                                <div className="flex items-center flex-1 overflow-hidden min-w-0 gap-2">
                                                    <div
                                                        className={cn(
                                                            "flex items-center justify-center w-4 h-4 shrink-0 rounded-full border transition-colors",
                                                            adresseLivraison ===
                                                                addr.value
                                                                ? "bg-primary border-primary text-primary-foreground"
                                                                : "border-muted-foreground"
                                                        )}
                                                    >
                                                        {adresseLivraison ===
                                                            addr.value && (
                                                            <Check className="w-2.5 h-2.5" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col truncate min-w-0">
                                                        <span className="truncate font-medium text-sm">
                                                            {addr.value}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground truncate">
                                                            {addr.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {addr.removable && (
                                                    <div
                                                        className="p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-destructive/10 sm:bg-transparent hover:bg-destructive/20 text-destructive sm:text-muted-foreground sm:hover:text-destructive rounded-md transition-[opacity,color,background-color] shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            removeAddressFromHistory(
                                                                addr.value
                                                            )
                                                        }}
                                                        title="Supprimer de l'historique"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>

                                    {searchDelivery &&
                                        !savedAddresses.find(
                                            (a) =>
                                                a.value.toLowerCase() ===
                                                searchDelivery.toLowerCase()
                                        ) && (
                                            <>
                                                <CommandSeparator />
                                                <CommandGroup>
                                                    <CommandItem
                                                        onSelect={() =>
                                                            onSaveAddress(
                                                                searchDelivery
                                                            )
                                                        }
                                                        className="cursor-pointer text-primary font-medium"
                                                    >
                                                        <Plus className="mr-2 h-4 w-4 shrink-0" />
                                                        <span className="truncate">
                                                            Utiliser : "
                                                            {searchDelivery}"
                                                        </span>
                                                    </CommandItem>
                                                </CommandGroup>
                                            </>
                                        )}
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            {/* --- 4. ADRESSE FACTURATION --- */}
            <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Adresse de Facturation
                </label>
                <div className="relative">
                    <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                        type="text"
                        value={adresseFacturation}
                        onChange={(e) => setAdresseFacturation(e.target.value)}
                        onFocus={handleFocus}
                        placeholder="Identique à livraison par défaut..."
                        className="pl-9 h-10 w-full bg-background hover:bg-accent/50 transition-colors"
                    />
                </div>
            </div>
        </div>
    )
}
