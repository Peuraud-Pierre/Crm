import {
    useMemo,
    memo,
    useState,
    useCallback,
    useRef,
    type ComponentType,
} from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Switch } from "@/shared/ui/atoms/switch"
import { Input } from "@/shared/ui/atoms/input"
import { Button } from "@/shared/ui/atoms/button"
import { useEffect } from "react"
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/shared/ui/organisms/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useClientSearch } from "@/features/crm/hooks/data/useClientSearch"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import type { UrgenceLevel } from "@/features/crm/types"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
    User,
    Calendar,
    Store,
    UserCheck,
    Briefcase,
    Check,
    ChevronsUpDown,
    Plus,
    Zap,
    Building2,
    Loader2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

import Createclient from "@/features/crm/components/Client/creation_client"

const HeaderLabel = ({
    icon: Icon,
    label,
    required,
}: {
    icon: ComponentType<{ className?: string }>
    label: string
    required?: boolean
}) => (
    <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1 sm:mb-1.5">
        <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        <span className="truncate">{label}</span>
        {required && <span className="text-red-500 shrink-0">*</span>}
    </label>
)

const QuoteHeader = memo(function QuoteHeader() {
    const {
        clients,
        search,
        setUsersee,
        setSelectedClient,
        setCreationclient,
        creationclient,
        selectedClient,
        update_fiche_client,
    } = useCRMContext()

    const {
        client,
        setClient,
        datedesaisis,
        setDatedesaisis,
        checked,
        setChecked,
        creator,
        setCreator,
        setTvaNumber,
        siret,
        setSiret,
        setTVA,
        urgence,
        setUrgence,
    } = useDevisContext()

    const { user } = useAuth()
    const [openClient, setOpenClient] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    // Recherche serveur (débounce dans useClientSearch) sur nom, téléphone, mail,
    // société ; terme vide → clients récents. Elle a sa propre entrée de cache et
    // n'écrase plus la liste du Kanban ; le client choisi reste trouvable dans
    // `clients` (stock commun).
    const pickerClients = useClientSearch(searchQuery, 50)

    // --- CLAVIER TABLETTE : plafonne la liste de résultats à l'espace visible ---
    // Le menu reste sous le champ (avoidCollisions=false) ; on limite donc la
    // hauteur de la liste à l'espace entre le champ et le haut du clavier pour
    // qu'aucun résultat ne se retrouve caché dessous.
    const triggerRef = useRef<HTMLButtonElement>(null)
    const [kb, setKb] = useState({ inset: 0, height: 0, top: 0 })
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return
        const onResize = () => {
            const inset = Math.max(
                0,
                window.innerHeight - vv.height - vv.offsetTop
            )
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- synchronisation sur une source externe (visualViewport)
            setKb({ inset, height: vv.height, top: vv.offsetTop })
        }
        onResize()
        vv.addEventListener("resize", onResize)
        vv.addEventListener("scroll", onResize)
        return () => {
            vv.removeEventListener("resize", onResize)
            vv.removeEventListener("scroll", onResize)
        }
    }, [])

    const [listMaxH, setListMaxH] = useState(200)
    useEffect(() => {
        if (!openClient) return
        const rect = triggerRef.current?.getBoundingClientRect()
        if (!rect) return
        const keyboardTop =
            kb.inset > 0 ? kb.top + kb.height : window.innerHeight
        // Espace sous le champ jusqu'au clavier, moins l'input de recherche (~44),
        // le sideOffset (4), la ligne « Créer » (~48) et une marge (8).
        const available = keyboardTop - rect.bottom - 4 - 44 - 48 - 8
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- mesure de géométrie DOM (getBoundingClientRect), non dérivable hors effet
        setListMaxH(Math.max(110, Math.min(240, available)))
    }, [openClient, kb])

    // --- SIRET : enrichissement API + persistance sur la fiche client ---
    const [isFetchingSiret, setIsFetchingSiret] = useState(false)
    const [siretValid, setSiretValid] = useState(false)

    const selectedClientObj = useMemo(
        () => clients.find((c) => c.id === client),
        [clients, client]
    )

    // Appelle l'API entreprise sur le SIREN (9 premiers chiffres du SIRET).
    // Si le numéro est valide, on renseigne TVA/société localement ET on enregistre
    // l'enrichissement sur la fiche client (société, SIRET, N° TVA).
    const handleSiretEnrichment = useCallback(
        async (sirenCandidate: string) => {
            if (sirenCandidate.length !== 9) return
            setIsFetchingSiret(true)
            try {
                const res = await fetch(
                    `https://info.nokk-project.example/api/entreprise/${sirenCandidate}`,
                    {
                        method: "GET",
                        headers: { "Content-Type": "application/json" },
                    }
                )
                if (!res.ok) {
                    setSiretValid(false)
                    return
                }
                const data = await res.json()

                // Mise à jour locale du devis
                if (data.tva) setTvaNumber(data.tva)
                const newSiret = data.siret || data.siretsiege
                if (newSiret) setSiret(newSiret)
                if (data.tva?.startsWith("FR")) setTVA("20")
                setSiretValid(true)

                // Persistance sur la fiche client (uniquement si un client est sélectionné)
                if (client) {
                    const updates: {
                        id: string
                        societe?: string
                        siret?: string
                        numero_TVA?: string
                    } = { id: client }
                    const newName = data.denomination || data.nom_complet
                    if (newName) updates.societe = newName
                    if (newSiret) updates.siret = newSiret
                    if (data.tva) updates.numero_TVA = data.tva
                    if (Object.keys(updates).length > 1) {
                        await update_fiche_client(updates)
                    }
                }
            } catch (error) {
                console.error("💥 Erreur enrichissement SIRET :", error)
            } finally {
                setIsFetchingSiret(false)
            }
        },
        [client, setTvaNumber, setSiret, setTVA, update_fiche_client]
    )

    // Débounce : valide/enrichit dès que le SIRET atteint 9 chiffres. Si le numéro
    // saisi correspond déjà à celui de la fiche (déjà enrichie), on évite un appel.
    useEffect(() => {
        const clean = (siret || "").replace(/\D/g, "")
        if (clean.length < 9) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- réinitialisation coordonnée avec l'enrichissement asynchrone sur le même état
            setSiretValid(false)
            return
        }
        const alreadyEnriched =
            selectedClientObj?.siret?.replace(/\D/g, "") === clean &&
            !!selectedClientObj?.numero_TVA &&
            !!selectedClientObj?.societe
        if (alreadyEnriched) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- validation coordonnée avec l'enrichissement asynchrone sur le même état
            setSiretValid(true)
            return
        }
        const t = setTimeout(() => {
            handleSiretEnrichment(clean.substring(0, 9))
        }, 1000)
        return () => clearTimeout(t)
    }, [siret, selectedClientObj, handleSiretEnrichment])

    // --- 🪄 AUTO-SCROLL SUR FOCUS (FIX CLAVIER TABLETTE/MOBILE) ---
    const handleFocus = (e: React.SyntheticEvent) => {
        const target = e.currentTarget
        setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
    }

    const handleCreateClient = useCallback(() => {
        setOpenClient(false)
        setSelectedClient?.(null)
        setUsersee?.(null)
        setCreationclient?.(true)
    }, [setSelectedClient, setUsersee, setCreationclient])

    const creatorsList = useMemo(() => {
        const list = search ? [...search] : []
        if (user?.user_id && !list.find((u) => u.user_id === user.user_id)) {
            list.push({
                id: user.id || "temp-id",
                user_id: user.user_id,
                name: user.full_name || "Moi",
            })
        }
        return list
    }, [search, user])

    return (
        // Grid responsive : 1 col sur tel, 2 cols sur tablette (sm), 4 cols sur bureau (md)
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 p-3 sm:p-4 dark:bg-background/50 backdrop-blur-sm rounded-lg shadow-sm border border-border/50">
            {/* 1. Client Selector */}
            <div className="flex flex-col min-w-0">
                <HeaderLabel icon={User} label="Client" required />
                <Popover
                    open={openClient}
                    onOpenChange={setOpenClient}
                    modal={true}
                >
                    <PopoverTrigger asChild>
                        <Button
                            ref={triggerRef}
                            variant="outline"
                            role="combobox"
                            aria-expanded={openClient}
                            onClick={handleFocus}
                            className={cn(
                                "w-full justify-between h-9 text-sm px-3",
                                "bg-card dark:bg-background/50 border-gray-200 dark:border-border hover:bg-card/80",
                                !client && "text-muted-foreground"
                            )}
                        >
                            <span className="truncate text-left flex-1 min-w-0">
                                {clients
                                    ? clients?.find((c) => c.id === client)
                                          ?.nom || "Sélectionner un client..."
                                    : "Sélectionner un client..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>

                    <PopoverContent
                        // Correction critique pour mobile (max-w-[90vw])
                        className="w-full max-w-[90vw] md:w-[var(--radix-popover-trigger-width)] min-w-[min(90vw,250px)] p-0"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                        // avoidCollisions={false} : garde le menu SOUS le champ même
                        // quand le clavier tablette réduit l'espace en bas (sinon Radix
                        // le bascule au-dessus de l'input).
                        avoidCollisions={false}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        {/* shouldFilter={false} : le filtrage est fait par le serveur
                            (fetch_client), pas par cmdk — sinon les correspondances sur
                            téléphone/mail/société seraient masquées car la value=nom. */}
                        <Command shouldFilter={false} className="overflow-hidden">
                            <div className="border-b border-gray-100 dark:border-gray-800">
                                <CommandInput
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                    className="h-9 text-sm"
                                />
                            </div>

                            <CommandList
                                className="overflow-y-auto custom-scrollbar"
                                style={{ maxHeight: listMaxH }}
                            >
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={handleCreateClient}
                                        className="text-primary aria-selected:bg-primary/10 aria-selected:text-primary cursor-pointer text-sm font-medium"
                                    >
                                        <Plus className="mr-2 h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">
                                            {searchQuery
                                                ? `Créer "${searchQuery}"`
                                                : "Nouveau Client"}
                                        </span>
                                    </CommandItem>
                                </CommandGroup>

                                <CommandGroup
                                    heading="Clients existants"
                                    className="pt-0"
                                >
                                    {pickerClients.length > 0 ? (
                                        pickerClients.map((c) => (
                                            <CommandItem
                                                key={c.id}
                                                value={c.nom || ""}
                                                onSelect={() => {
                                                    const newClientId =
                                                        c.id === client
                                                            ? ""
                                                            : c.id!
                                                    setClient(newClientId)
                                                    if (newClientId) {
                                                        setTvaNumber(
                                                            c.numero_TVA || ""
                                                        )
                                                        setSiret(c.siret || "")
                                                    } else {
                                                        setTvaNumber("")
                                                        setSiret("")
                                                    }
                                                    setOpenClient(false)
                                                }}
                                                className="cursor-pointer text-sm py-1.5 flex items-center gap-2"
                                            >
                                                <Check
                                                    className={cn(
                                                        "h-3.5 w-3.5 shrink-0 text-primary",
                                                        client === c.id
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                    )}
                                                />
                                                <span className="truncate flex-1 min-w-0">
                                                    {c.nom}
                                                </span>
                                            </CommandItem>
                                        ))
                                    ) : (
                                        <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                                            Aucun autre résultat.
                                        </p>
                                    )}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* 2. SIRET (enrichissement + sauvegarde fiche client via API) */}
            <div className="flex flex-col min-w-0">
                <HeaderLabel icon={Building2} label="SIRET" />
                <div className="relative">
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={siret || ""}
                        onChange={(e) =>
                            setSiret(
                                e.target.value.replace(/\D/g, "").slice(0, 14)
                            )
                        }
                        onFocus={handleFocus}
                        placeholder="14 chiffres"
                        maxLength={14}
                        className={cn(
                            "h-9 w-full px-3 text-sm bg-card dark:bg-background/50 border-gray-200 dark:border-border hover:bg-card/80 transition-colors pr-8",
                            siretValid &&
                                "border-green-500 text-green-700 dark:text-green-400"
                        )}
                    />
                    {isFetchingSiret && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        </div>
                    )}
                    {!isFetchingSiret && siretValid && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Check className="h-3.5 w-3.5 text-green-600" />
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Expiration Date */}
            <div className="flex flex-col min-w-0">
                <HeaderLabel icon={Calendar} label="Date de saisie" required />
                <div className="relative w-full">
                    <Input
                        type="date"
                        value={datedesaisis}
                        onChange={(e) => setDatedesaisis(e.target.value)}
                        onFocus={handleFocus}
                        className={cn(
                            "bg-card dark:bg-background/50 border-gray-200 dark:border-border hover:bg-card/80 transition-colors",
                            "h-9 w-full block min-w-full px-3 py-1.5 text-sm", // Uniformisé à h-9
                            "appearance-none"
                        )}
                        required
                    />
                </div>
            </div>

            {/* 3. Service Switch */}
            <div className="flex flex-col min-w-0">
                <HeaderLabel icon={Store} label="Origine Stock" />
                <div className="flex items-center justify-between h-9 px-2 sm:px-3 rounded-md border border-gray-200 dark:border-border bg-card dark:bg-background/50 overflow-hidden">
                    <span
                        className={cn(
                            "text-[11px] sm:text-xs font-medium transition-colors duration-slow cursor-pointer truncate flex-1 text-right",
                            !checked
                                ? "text-primary font-bold"
                                : "text-muted-foreground"
                        )}
                        onClick={() => setChecked(false)}
                    >
                        Entrepôt
                    </span>
                    <Switch
                        checked={checked}
                        onCheckedChange={setChecked}
                        className="data-[state=checked]:bg-red-400 data-[state=unchecked]:bg-green-400 shadow-sm shrink-0 mx-1 sm:mx-2 scale-90 sm:scale-100"
                    />
                    <span
                        className={cn(
                            "text-[11px] sm:text-xs font-medium transition-colors duration-slow cursor-pointer truncate flex-1",
                            checked
                                ? "text-red-600 font-bold"
                                : "text-muted-foreground"
                        )}
                        onClick={() => setChecked(true)}
                    >
                        Handpick
                    </span>
                </div>
            </div>

            {/* 4. Creator Selector */}
            <div className="flex flex-col min-w-0">
                <HeaderLabel icon={UserCheck} label="Créateur" />
                <Select value={creator} onValueChange={setCreator} required>
                    <SelectTrigger className="w-full bg-card dark:bg-background/50 border-gray-200 dark:border-border hover:bg-card/80 transition-colors h-9 px-3">
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <SelectValue
                                placeholder="Sélectionner..."
                                className="truncate"
                            />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {creatorsList && creatorsList.length > 0 ? (
                            creatorsList.map((c) => {
                                if (!c.user_id) return null
                                return (
                                    <SelectItem
                                        key={c.user_id}
                                        value={c.user_id}
                                        className="truncate"
                                    >
                                        {c.name || "Utilisateur sans nom"}
                                    </SelectItem>
                                )
                            })
                        ) : (
                            <div className="p-2 text-xs text-muted-foreground text-center">
                                Aucun créateur disponible
                            </div>
                        )}
                    </SelectContent>
                </Select>
            </div>

            {/* 5. Urgence */}
            <div className="flex flex-col min-w-0">
                <HeaderLabel icon={Zap} label="Urgence" />
                <div className="grid grid-cols-3 gap-1 h-9">
                    {(["normale", "haute", "élevée"] as UrgenceLevel[]).map((level) => {
                        const styles: Record<UrgenceLevel, string> = {
                            normale: "border-gray-300 text-gray-600 data-[active=true]:bg-gray-100 data-[active=true]:border-gray-500 data-[active=true]:text-gray-800 dark:border-gray-600 dark:text-gray-400 dark:data-[active=true]:bg-gray-800/50 dark:data-[active=true]:border-gray-400 dark:data-[active=true]:text-gray-100",
                            haute: "border-orange-300 text-orange-600 data-[active=true]:bg-orange-100 data-[active=true]:border-orange-500 data-[active=true]:text-orange-700 dark:border-orange-800 dark:text-orange-400 dark:data-[active=true]:bg-orange-900/40 dark:data-[active=true]:border-orange-500 dark:data-[active=true]:text-orange-200",
                            élevée: "border-red-300 text-red-600 data-[active=true]:bg-red-100 data-[active=true]:border-red-500 data-[active=true]:text-red-700 dark:border-red-800 dark:text-red-400 dark:data-[active=true]:bg-red-900/40 dark:data-[active=true]:border-red-500 dark:data-[active=true]:text-red-200",
                        }
                        const labels: Record<UrgenceLevel, string> = {
                            normale: "Normale",
                            haute: "Haute",
                            élevée: "Élevée",
                        }
                        return (
                            <button
                                key={level}
                                type="button"
                                data-active={urgence === level}
                                onClick={() => setUrgence(level)}
                                className={cn(
                                    "flex-1 rounded-md border text-[11px] font-medium transition-colors",
                                    "bg-card dark:bg-background/50 dark:border-border",
                                    styles[level]
                                )}
                            >
                                {labels[level]}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* MODALE DE CRÉATION CLIENT */}
            {creationclient && (
                <Createclient
                    setCreationclient={setCreationclient}
                    client={selectedClient}
                />
            )}
        </div>
    )
})

export default QuoteHeader
