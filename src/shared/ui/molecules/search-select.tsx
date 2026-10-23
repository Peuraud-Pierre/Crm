import { useState, useMemo, useEffect, useRef, type KeyboardEvent } from "react"
import { Search } from "lucide-react"
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from "@/shared/ui/atoms/popover"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { cn } from "@/shared/lib/utils"
import { useListKeyboardNavigation } from "@/shared/hooks/useListKeyboardNavigation"
import { InfoTooltip } from "./info-tooltip"
import { SearchSelectButtonTrigger, SearchSelectInputField } from "./search-select-trigger"
import { SearchSelectCreate, SearchSelectItems, sameLabel, type SearchSelectOption } from "./search-select-list"

export type { SearchSelectOption }

export interface SearchSelectProps {
    options: SearchSelectOption[]
    value: string
    onChange: (value: string, label: string) => void
    placeholder?: string
    /**
     * "input"  — l'input EST le trigger avec recherche intégrée (formulaires)
     * "button" — trigger bouton compact, popover liste (barres de filtres)
     */
    variant?: "input" | "button"
    size?: "sm" | "md"
    /** variant="button" uniquement : ajoute une barre de recherche dans le popover */
    searchable?: boolean
    /** variant="input" uniquement : bordure colorée selon validité */
    showValidation?: boolean
    label?: string
    tooltip?: string
    tooltipSide?: "top" | "right" | "bottom" | "left"
    className?: string
    emptyMessage?: string
    required?: boolean
    /**
     * Notifié à chaque frappe, pour les listes qui ne tiennent pas en mémoire.
     *
     * Le filtrage interne reste actif : ce rappel ne le remplace pas, il permet
     * à l'appelant d'ALIMENTER `options` depuis le serveur pendant que
     * l'utilisateur tape. Sans lui, une liste paginée ne peut proposer que le
     * palier déjà chargé, et les entrées plus anciennes sont introuvables sans
     * que rien ne le signale.
     */
    onSearchChange?: (query: string) => void
    /**
     * Rend possible la création d'une entrée absente du référentiel, depuis la
     * liste elle-même, à partir du texte recherché. Le bouton n'apparaît que
     * si une recherche est saisie ET qu'aucune option ne porte déjà exactement
     * ce libellé (casse ignorée) : on ne crée pas un doublon d'un clic. Entrée
     * dans la recherche crée aussi, quand plus aucune option ne correspond.
     */
    onCreate?: (query: string) => void
    /** Intitulé au-dessus du texte à créer. Défaut : « Créer ». */
    createLabel?: string
    /**
     * Ouverture pilotée par l'appelant. Absente : la liste gère son ouverture
     * elle-même, comme avant. Présente, elle permet d'ouvrir la liste sans
     * souris depuis un raccourci clavier de l'écran hôte (la revue d'une packing
     * list ouvre ainsi la liste du libellé focalisé).
     */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /**
     * Rendre le focus au déclencheur à la fermeture. Vrai par défaut, et c'est
     * le bon défaut : dans un formulaire, on veut reprendre là où on était.
     *
     * À passer à `false` quand le déclencheur peut DISPARAÎTRE juste après le
     * choix. C'est le cas d'une liste posée dans une carte qui quitte l'écran
     * une fois traitée : Radix rendrait le focus à un nœud en cours de
     * démontage, le focus retomberait sur `<body>`, et l'enchaînement au clavier
     * s'arrêterait là — sans erreur, sans rien à l'écran pour l'expliquer.
     * L'écran hôte reste alors seul maître du focus.
     */
    restoreFocusOnClose?: boolean
}

/**
 * Liste déroulante cherchable — la liste de référence de tous les modules de
 * stock pour un choix dans un référentiel (fournisseur, catégorie,
 * emplacement…).
 *
 * Quand l'utiliser plutôt que `atoms/select`
 * ------------------------------------------
 * `SearchSelect` dès que les options viennent d'un référentiel : leur nombre
 * croît avec les données, et taper trois lettres bat toujours le défilement.
 * `atoms/select` reste le bon choix pour une énumération fermée et courte
 * (unité, sens d'un mouvement, statut) : y ajouter un champ de recherche pour
 * trois options serait du bruit.
 *
 * Parcours au clavier
 * -------------------
 * ↑ ↓ déplacent le surlignage (avec bouclage), Début/Fin vont aux extrémités,
 * Entrée choisit l'option surlignée, Échap referme. Sur le déclencheur compact,
 * ↓ ouvre la liste directement sur la première option. La logique est dans
 * `shared/hooks/useListKeyboardNavigation`.
 *
 * Deux règles se partagent Entrée, dans cet ordre : si une option est
 * surlignée, elle est choisie ; sinon, et si la recherche ne renvoie rien,
 * l'entrée absente est créée. Elles ne peuvent pas se disputer la touche,
 * puisqu'une liste vide n'a aucune option à surligner.
 *
 * Les options restent des `<button>` et non des `role="option"` : le passage à
 * la sémantique `listbox` est un changement de contrat pour les 25 appelants,
 * il se fera à part.
 *
 * Provenance : ce composant vivait sous `features/stock` sous le nom
 * `PopoverSelect`, invisible pour les autres modules — d'où le handpick câblé
 * sur des `<Select>` bruts sans recherche. Sa promotion s'est accompagnée du
 * remplacement de sa palette codée en dur (`slate`, `emerald`, `red`) par les
 * tokens du thème, condition d'entrée dans le design system.
 */

export function SearchSelect({
    options,
    value,
    onChange,
    placeholder = "Sélectionner...",
    variant = "button",
    size = "sm",
    searchable = false,
    showValidation = false,
    label,
    tooltip,
    tooltipSide = "top",
    className,
    emptyMessage = "Aucun résultat",
    required = false,
    onSearchChange,
    onCreate,
    createLabel = "Créer",
    open: openProp,
    onOpenChange,
    restoreFocusOnClose = true,
}: SearchSelectProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const [search, setSearch] = useState("")
    const isUserTypingRef = useRef(false)
    /** Barre de recherche du popover, pour lui donner le focus à l'ouverture. */
    const searchRef = useRef<HTMLInputElement>(null)

    // Contrôlé dès que l'appelant fournit `open` ; sinon l'état interne fait foi.
    const isOpen = openProp ?? internalOpen

    const [inputText, setInputText] = useState(
        () => options.find(o => o.value === value)?.label ?? ""
    )

    const selectedOption = useMemo(
        () => options.find(o => o.value === value),
        [options, value]
    )

    // Resync de l'input contrôlé quand la valeur change de l'extérieur
    // (variant="input" seulement).
    useEffect(() => {
        if (variant !== "input" || isUserTypingRef.current) return
        const expected = value && selectedOption ? selectedOption.label : ""
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        if (expected !== inputText) setInputText(expected)
    }, [value, selectedOption, variant])

    const filteredOptions = useMemo(() => {
        const query = variant === "input" ? inputText : search
        if (!query) return options
        const q = query.toLowerCase()
        return options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            o.subLabel?.toLowerCase().includes(q)
        )
    }, [options, inputText, search, variant])

    const isInputValid = selectedOption?.label === inputText && inputText !== ""

    const setOpen = (open: boolean) => {
        if (openProp === undefined) setInternalOpen(open)
        onOpenChange?.(open)
    }

    const handleSelect = (opt: SearchSelectOption) => {
        isUserTypingRef.current = false
        onChange(opt.value, opt.label)
        if (variant === "input") setInputText(opt.label)
        setSearch("")
        setOpen(false)
    }

    const navigation = useListKeyboardNavigation({
        length: filteredOptions.length,
        onSelect: index => {
            const opt = filteredOptions[index]
            if (opt) handleSelect(opt)
        },
        onDismiss: () => setOpen(false),
    })

    const handleInputChange = (val: string) => {
        isUserTypingRef.current = true
        setInputText(val)
        setOpen(val.length > 0)
        // Après une frappe, la première option restante est la plus probable :
        // Entrée doit la choisir sans qu'on ait à redescendre avec ↓.
        navigation.setHighlighted(0)
        if (val !== selectedOption?.label) onChange("", "")
        onSearchChange?.(val)
        setTimeout(() => { isUserTypingRef.current = false }, 100)
    }

    /** Saisie de la barre de recherche du popover (`variant="button"`). */
    const handleSearchChange = (val: string) => {
        setSearch(val)
        navigation.setHighlighted(0)
        onSearchChange?.(val)
    }

    const handleClearInput = () => {
        onChange("", "")
        setInputText("")
        setOpen(false)
    }

    const handleOpenChange = (open: boolean) => {
        setOpen(open)
        if (!open) {
            setSearch("")
            // Rien de surligné à la réouverture : surligner d'office la première
            // entrée d'un référentiel de 300 lignes se lirait comme une
            // présélection.
            navigation.setHighlighted(-1)
        }
    }

    const createQuery = (variant === "input" ? inputText : search).trim()
    const canCreate =
        Boolean(onCreate) &&
        createQuery !== "" &&
        !options.some((o) => sameLabel(o.label, createQuery))

    const handleCreate = () => {
        if (!canCreate) return
        setSearch("")
        setOpen(false)
        onCreate?.(createQuery)
    }

    /**
     * Entrée appartient à la navigation quand une option est surlignée, et à la
     * création sinon. `onKeyDown` du hook renvoie `true` quand il a tranché.
     */
    const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (navigation.onKeyDown(event)) return
        if (event.key === "Enter" && filteredOptions.length === 0 && canCreate) {
            event.preventDefault()
            handleCreate()
        }
    }

    /**
     * ↓ sur le déclencheur ouvre la liste DÉJÀ positionnée sur la première
     * option : sans ça, ouvrir au clavier demande une frappe de plus que de
     * raison. Une fois ouverte et SANS barre de recherche, le focus reste sur le
     * déclencheur — c'est donc lui qui porte le parcours.
     */
    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!isOpen) {
            if (event.key !== "ArrowDown") return
            event.preventDefault()
            navigation.setHighlighted(0)
            setOpen(true)
            return
        }
        navigation.onKeyDown(event)
    }

    const h = size === "sm" ? "h-8" : "h-10"
    const tx = size === "sm" ? "text-xs" : "text-sm"

    const itemList = (
        <SearchSelectItems
            options={filteredOptions}
            value={value}
            onSelect={handleSelect}
            textClass={tx}
            emptyMessage={emptyMessage}
            highlighted={navigation.highlighted}
            itemId={navigation.itemId}
            registerItem={navigation.registerItem}
        />
    )

    const popoverContent = (
        <PopoverContent
            className={cn(
                // `w-[--radix-popover-trigger-width]` : variable exposée par Radix
                // pour aligner le popover sur la largeur de son déclencheur. Ce
                // n'est pas une valeur magique, c'est l'API documentée.
                "p-0 w-[--radix-popover-trigger-width] shadow-2xl backdrop-blur-sm overflow-hidden",
                // Création offerte : un déclencheur étroit (colonne d'une ligne
                // dépliée) rendrait recherche et création illisibles.
                onCreate ? "min-w-64" : "min-w-45",
                "bg-card border-border shadow-sm"
            )}
            align="start"
            sideOffset={5}
            collisionPadding={10}
            /**
             * Le focus est posé ICI, explicitement, et pas par un `autoFocus`
             * sur le champ.
             *
             * `autoFocus` est un effet de bord du montage : il dépend de
             * l'ordre dans lequel React et le piège de focus de Radix
             * s'exécutent, et ce popover s'ouvre de trois façons (clic sur le
             * déclencheur, ↓ au clavier, `open` piloté par l'écran hôte — la
             * touche Espace de la revue d'une packing list). Dans une sheet,
             * qui est elle-même un piège de focus et dont le popover sort par
             * un portail, le résultat n'était pas le même partout : la liste
             * s'ouvrait parfois sans curseur, et il fallait cliquer le champ
             * avant de pouvoir taper.
             *
             * `preventDefault()` neutralise le focus automatique de Radix, puis
             * on désigne la cible. Sans barre de recherche, le focus reste au
             * déclencheur : c'est lui qui porte alors le parcours clavier.
             */
            onOpenAutoFocus={event => {
                event.preventDefault()
                searchRef.current?.focus()
            }}
            onCloseAutoFocus={restoreFocusOnClose ? undefined : e => e.preventDefault()}
            onPointerDownOutside={variant === "input" ? () => setOpen(false) : undefined}
        >
            {searchable && variant === "button" && (
                <div className="p-2 border-b border-border">
                    <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            ref={searchRef}
                            placeholder="Rechercher..."
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            onKeyDown={handleFieldKeyDown}
                            aria-activedescendant={navigation.activeDescendantId}
                            className="pl-7 h-7 text-xs bg-transparent border-border focus-visible:ring-1"
                        />
                    </div>
                </div>
            )}
            {itemList}
            {canCreate && (
                <SearchSelectCreate
                    query={createQuery}
                    label={createLabel}
                    textClass={tx}
                    onCreate={handleCreate}
                />
            )}
        </PopoverContent>
    )

    const inner = (
        <div className={cn(
            "flex flex-col w-full",
            label && (size === "sm" ? "gap-1.5" : "gap-2"),
            className
        )}>
            {label && (
                <div className="flex items-center gap-2">
                    <Label className={cn(
                        "font-bold uppercase tracking-wider text-muted-foreground",
                        size === "sm" ? "text-3xs" : "text-xs"
                    )}>
                        {label}
                        {required && <span className="ml-0.5 text-destructive">*</span>}
                    </Label>
                    {tooltip && <InfoTooltip side={tooltipSide} content={tooltip} />}
                </div>
            )}

            <Popover open={isOpen} onOpenChange={handleOpenChange} modal={false}>
                {variant === "input" ? (
                    <PopoverAnchor asChild>
                        <SearchSelectInputField
                            placeholder={placeholder}
                            heightClass={h}
                            showValidation={showValidation}
                            isInputValid={isInputValid}
                            inputText={inputText}
                            isOpen={isOpen}
                            onFocus={() => !isInputValid && inputText.length > 0 && setOpen(true)}
                            onTextChange={handleInputChange}
                            onKeyDown={handleFieldKeyDown}
                            activeDescendantId={navigation.activeDescendantId}
                            onClear={handleClearInput}
                        />
                    </PopoverAnchor>
                ) : (
                    <PopoverTrigger asChild>
                        <SearchSelectButtonTrigger
                            selectedLabel={selectedOption?.label ?? null}
                            placeholder={placeholder}
                            heightClass={h}
                            textClass={tx}
                            isOpen={isOpen}
                            onKeyDown={handleTriggerKeyDown}
                        />
                    </PopoverTrigger>
                )}
                {popoverContent}
            </Popover>
        </div>
    )

    return tooltip ? (
        <TooltipProvider delayDuration={300}>{inner}</TooltipProvider>
    ) : inner
}
