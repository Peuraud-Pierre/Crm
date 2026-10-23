import { useEffect, useRef, useState } from "react"
import { Truck, Store, MapPin, Check, X, Loader2, Search } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// UI Components
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/ui/atoms/select"
import { Input } from "@/shared/ui/atoms/input"

// Contexts
import { useDevisContext } from "@/features/crm/context/DevisContext"
import { fetchAddressSuggestions } from "@/features/crm/utils/addressApi"

/**
 * Choix simplifié du mode de livraison, affiché sous le Ticket.
 * - Type (Exworks / Emporter / Livraison) transmis au PDF via `Livraison`.
 * - Pour Exworks et Livraison : champ de recherche d'adresse en saisie directe
 *   (carnet client + autocomplétion via le service Go), sans clic préalable.
 */
export default function LivraisonChoice() {
    const {
        Livraison,
        setLivraisonMethod,
        adresseLivraison,
        setAdresseLivraison,
        savedAddresses,
        removeAddressFromHistory,
    } = useDevisContext()

    // Requête de recherche (texte tapé) et affichage du menu déroulant.
    const [searchDelivery, setSearchDelivery] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)

    // --- AUTOCOMPLÉTION : l'appel passe par le service Go
    // (pont fetchAddressSuggestions → info/adresse.go). Recherche débouncée. ---
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [loadingSugg, setLoadingSugg] = useState(false)
    const abortRef = useRef<AbortController | null>(null)
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const q = searchDelivery.trim()
        if (q.length < 3) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- réinitialisation d'une recherche asynchrone débouncée
            setSuggestions([])
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- réinitialisation d'une recherche asynchrone débouncée
            setLoadingSugg(false)
            return
        }

        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- état de chargement d'une recherche asynchrone débouncée
        setLoadingSugg(true)
        const timer = setTimeout(async () => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller
            try {
                const labels = await fetchAddressSuggestions(
                    q,
                    controller.signal
                )
                setSuggestions(labels)
            } catch (err) {
                if ((err as Error)?.name !== "AbortError") setSuggestions([])
            } finally {
                setLoadingSugg(false)
            }
        }, 350)

        return () => clearTimeout(timer)
    }, [searchDelivery])

    // L'adresse n'a de sens que pour Exworks et Livraison (pas pour le retrait dépôt).
    const showAddress = Livraison !== "Emporter"

    // Filtrage du carnet selon la saisie.
    const search = searchDelivery.trim().toLowerCase()
    const filteredSaved = search
        ? savedAddresses.filter((a) => a.value.toLowerCase().includes(search))
        : savedAddresses
    // Suggestions API dédoublonnées par rapport au carnet.
    const newSuggestions = suggestions.filter(
        (s) =>
            !savedAddresses.some(
                (a) => a.value.toLowerCase() === s.toLowerCase()
            )
    )

    const pickAddress = (value: string) => {
        setAdresseLivraison(value)
        setSearchDelivery("")
        setShowDropdown(false)
    }

    // 🪄 Clavier tablette/mobile : on remonte le champ au centre de la zone
    // visible (au-dessus du clavier virtuel) pour que le menu reste visible.
    const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
        setShowDropdown(true)
        const target = e.target
        setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
    }

    return (
        <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-xl border shadow-sm">
            {/* --- TYPE DE LIVRAISON --- */}
            <div className="flex flex-col gap-2">
                <label className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Mode de livraison
                </label>
                <Select value={Livraison} onValueChange={setLivraisonMethod}>
                    <SelectTrigger className="w-full h-10 bg-background border-input hover:bg-accent/50 transition-colors rounded-md px-3 flex items-center gap-2 focus:ring-2 focus:ring-ring">
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
                        <SelectItem
                            value="Emporter"
                            className="cursor-pointer py-2"
                        >
                            <div className="flex items-center gap-2 px-1 sm:px-3">
                                <Store className="w-4 h-4 text-orange-600 shrink-0" />
                                <span className="truncate">
                                    Emporté par vos soins
                                </span>
                            </div>
                        </SelectItem>
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
                    </SelectContent>
                </Select>
            </div>

            {/* --- ADRESSE : recherche directe (Exworks & Livraison) --- */}
            {showAddress && (
                <div className="flex flex-col gap-2">
                    <label className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>Adresse de livraison</span>
                        {adresseLivraison && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                                Validée
                            </span>
                        )}
                    </label>

                    <div className="relative">
                        {/* Champ de saisie directe */}
                        <MapPin
                            className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 shrink-0 pointer-events-none",
                                adresseLivraison
                                    ? "text-primary"
                                    : "text-muted-foreground"
                            )}
                        />
                        <Input
                            type="text"
                            value={searchDelivery || adresseLivraison}
                            placeholder="Rechercher une adresse..."
                            className="pl-9 pr-9 h-10 w-full bg-background hover:bg-accent/50 transition-colors"
                            onChange={(e) => {
                                setSearchDelivery(e.target.value)
                                setAdresseLivraison(e.target.value)
                                setShowDropdown(true)
                            }}
                            onFocus={handleFieldFocus}
                            onBlur={() => {
                                // Léger délai pour laisser le clic sur une suggestion passer.
                                blurTimerRef.current = setTimeout(
                                    () => setShowDropdown(false),
                                    150
                                )
                            }}
                        />
                        {loadingSugg && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}

                        {/* Menu déroulant des résultats */}
                        {showDropdown &&
                            (filteredSaved.length > 0 ||
                                newSuggestions.length > 0 ||
                                (search.length >= 3 && !loadingSugg)) && (
                                <div className="absolute z-50 mt-1 w-full max-h-52 sm:max-h-64 overflow-y-auto overscroll-contain rounded-md border bg-popover text-popover-foreground shadow-md scrollbar-thin">
                                    {/* Carnet d'adresses */}
                                    {filteredSaved.length > 0 && (
                                        <div className="p-1">
                                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Carnet d'adresses
                                            </p>
                                            {filteredSaved.map((addr) => (
                                                <div
                                                    key={addr.value}
                                                    role="button"
                                                    tabIndex={0}
                                                    onMouseDown={(e) =>
                                                        e.preventDefault()
                                                    }
                                                    onClick={() =>
                                                        pickAddress(addr.value)
                                                    }
                                                    className="group flex items-center justify-between gap-2 px-2 py-2 rounded-sm cursor-pointer hover:bg-accent"
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
                                                            onMouseDown={(e) =>
                                                                e.preventDefault()
                                                            }
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
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Suggestions API */}
                                    {newSuggestions.length > 0 && (
                                        <div
                                            className={cn(
                                                "p-1",
                                                filteredSaved.length > 0 &&
                                                    "border-t"
                                            )}
                                        >
                                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                Suggestions (Base Adresse
                                                Nationale)
                                            </p>
                                            {newSuggestions.map((sugg) => (
                                                <div
                                                    key={sugg}
                                                    role="button"
                                                    tabIndex={0}
                                                    onMouseDown={(e) =>
                                                        e.preventDefault()
                                                    }
                                                    onClick={() =>
                                                        pickAddress(sugg)
                                                    }
                                                    className="flex items-center gap-2 px-2 py-2 rounded-sm cursor-pointer hover:bg-accent"
                                                >
                                                    <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
                                                    <span className="truncate text-sm">
                                                        {sugg}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Aucun résultat */}
                                    {filteredSaved.length === 0 &&
                                        newSuggestions.length === 0 &&
                                        !loadingSugg && (
                                            <p className="px-3 py-2 text-xs text-muted-foreground text-center">
                                                {search.length < 3
                                                    ? "Tapez au moins 3 caractères pour rechercher."
                                                    : "Aucune adresse trouvée."}
                                            </p>
                                        )}
                                </div>
                            )}
                    </div>
                </div>
            )}
        </div>
    )
}
