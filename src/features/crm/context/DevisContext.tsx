import {
    createContext,
    use,
    useState,
    useCallback,
    useMemo,
    useEffect,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react"
import { toast } from "sonner"
import type { Product, Devis, UrgenceLevel, QuoteProduct, Client, AddressItem, LigneProduit } from "@/features/crm/types"
import { useCRMContext } from "./CRMContext"
import { useClientById } from "@/features/crm/hooks/data/useClientsCache"
import { useAuth, type AppUser } from "@/features/auth/hooks/useAuth"

type AddressHistoryItem =
    | string
    | { address?: string; label?: string; date?: string }
// Cohérent avec la signature exposée par useCRMContext (qui accepte string
// pour les UUIDs joints customer/closers, là où Client typé attend un Owner).
type UpdateFicheClientFn = (changes: {
    id: string
    [key: string]: unknown
}) => Promise<void> | void
// Forme passée à `loadQuoteData` (Devis legacy DB : champs TvaNumber, produit, prix, TVA…).
type LegacyQuoteRow = {
    [key: string]: unknown
    // Accepte aussi bien les lignes typées (Devis.Tableau) que les lignes
    // brutes héritées ; le corps de loadQuoteData les relit via des clés string.
    Tableau?: Array<Record<string, unknown>> | LigneProduit[]
    Remise?: string | QuoteProduct[] | null
    TvaNumber?: string
    TVA?: number | null
}
import {
    UseFournisseur,
    type Fournisseur,
} from "../hooks/CRM_hook/use_fournisseur"

// AddressItem importé depuis @/features/crm/types/quote
export type { AddressItem } from "@/features/crm/types"

// ==========================================
// 🎨 TYPES & INTERFACES
// ==========================================
export interface DevisContextType {
    client: string
    setClient: (v: string) => void
    user: AppUser | null
    creator: string
    setCreator: (v: string) => void
    isPDFDisabled: boolean
    products: QuoteProduct[]
    setProducts: (
        v: QuoteProduct[] | ((p: QuoteProduct[]) => QuoteProduct[])
    ) => void
    inputValue: string
    setInputValue: (v: string) => void
    filtered: Product[]
    datedesaisis: string
    setDatedesaisis: (v: string) => void
    expirationDate: string
    setExpirationDate: (v: string) => void
    mode: "" | "remise" | "nouveau" | "existant"
    setMode: Dispatch<SetStateAction<"" | "remise" | "nouveau" | "existant">>
    discountType: "percent" | "fixed"
    setDiscountType: Dispatch<SetStateAction<"percent" | "fixed">>
    discountPercent: number
    setDiscountPercent: (v: number) => void
    paymentMethod: string
    setPaymentMethod: (v: string) => void
    Livraison: string
    setLivraisonMethod: (v: string) => void
    note: string
    setNote: (v: string) => void
    adresseLivraison: string
    setAdresseLivraison: (v: string) => void
    adresseFacturation: string
    setAdresseFacturation: (v: string) => void
    savedAddresses: AddressItem[]
    addAddressToHistory: (addr: string) => Promise<void>
    removeAddressFromHistory: (addr: string) => Promise<void>
    TVA: string
    setTVA: (v: string) => void
    TvaNumber: string
    setTvaNumber: (v: string) => void
    status: string
    setStatus: (v: string) => void
    checked: boolean
    setChecked: (v: boolean) => void
    checkedKil: boolean
    setCheckedKil: (v: boolean) => void
    maxQuantity: number | undefined
    setMaxQuantity: (v: number | undefined) => void
    payments: { method: string; amount: number }[]
    setPayments: Dispatch<
        SetStateAction<{ method: string; amount: number }[]>
    >
    AvoirValue: number
    setAvoirValue: (v: number) => void
    remises: QuoteProduct[]
    setRemises: Dispatch<SetStateAction<QuoteProduct[]>>
    numeroDevis: string
    round2: (num: number) => number
    totals: { totalHT: number; totalTVA: number; totalTTC: number }
    prepareDevis: () => Devis
    loadQuoteData: (quote: LegacyQuoteRow | Devis) => void
    resetDevis: () => void
    siret: string | undefined
    setSiret: (v: string | undefined) => void
    fournisseurs: Fournisseur[]
    fetch_Fournisseur: () => Promise<Fournisseur[] | undefined>
    urgence: UrgenceLevel
    setUrgence: (v: UrgenceLevel) => void
}

const DevisContext = createContext<DevisContextType | undefined>(undefined)

// ==========================================
// 🛠️ FONCTIONS UTILITAIRES
// ==========================================
const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100

const generateNumeroDevis = () => {
    const date = new Date()
    const yyyy = date.getFullYear().toString().slice(-2)
    const MM = (date.getMonth() + 1).toString().padStart(2, "0")
    const dd = date.getDate().toString().padStart(2, "0")
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    return `D${yyyy}${MM}${dd}-${randomNum}`
}

// ==========================================
// 🧩 SUB-HOOK : GESTION DES ADRESSES
// ==========================================
function useDevisAddresses(
    client: string,
    selectedClient: Client | null | undefined,
    update_fiche_client: UpdateFicheClientFn | null | undefined
) {
    const [adresseLivraison, setAdresseLivraison] = useState("")
    const [adresseFacturation, setAdresseFacturation] = useState("")

    const savedAddresses = useMemo<AddressItem[]>(() => {
        if (!selectedClient) return []
        const rawAddresses: AddressItem[] = [
            {
                label: "Adresse Principale",
                value: selectedClient.localisation || "",
                removable: false,
            },
            {
                label: "Adresse Facturation",
                value:
                    typeof selectedClient.adresse_facturation === "string"
                        ? selectedClient.adresse_facturation
                        : Array.isArray(selectedClient.adresse_facturation)
                          ? selectedClient.adresse_facturation[0]?.address ||
                            ""
                          : "",
                removable: false,
            },
        ]

        const history = selectedClient.adresse_livraison || []
        if (Array.isArray(history)) {
            history.forEach((item: AddressHistoryItem) => {
                const addrStr =
                    typeof item === "string" ? item : item.address ?? ""
                const lbl =
                    typeof item === "string"
                        ? "Historique"
                        : item.label || "Historique"
                if (addrStr?.trim())
                    rawAddresses.push({
                        value: addrStr,
                        label: lbl,
                        removable: true,
                    })
            })
        }

        const uniqueMap = new Map()
        rawAddresses.forEach((item) => {
            if (!item.value?.trim()) return
            const key = item.value.trim().toLowerCase()
            if (uniqueMap.has(key)) {
                if (uniqueMap.get(key).removable && !item.removable)
                    uniqueMap.set(key, { ...item, removable: false })
            } else {
                uniqueMap.set(key, { ...item, value: item.value.trim() })
            }
        })
        return Array.from(uniqueMap.values())
    }, [selectedClient])

    // Remplissage auto
    useEffect(() => {
        if (savedAddresses.length > 0) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- pré-remplissage initial des champs (éditables ensuite par l'utilisateur)
            if (!adresseLivraison) setAdresseLivraison(savedAddresses[0].value)
            if (!adresseFacturation)
                // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- pré-remplissage initial des champs (éditables ensuite par l'utilisateur)
                setAdresseFacturation(savedAddresses[0].value)
        }
    }, [client, savedAddresses])

    const addAddressToHistory = useCallback(
        async (newAddress: string) => {
            if (
                !newAddress ||
                !client ||
                !selectedClient ||
                !update_fiche_client
            )
                return
            setAdresseLivraison(newAddress)
            try {
                const oldHistory = Array.isArray(
                    selectedClient.adresse_livraison
                )
                    ? selectedClient.adresse_livraison
                    : []
                if (
                    oldHistory.some(
                        (item: AddressHistoryItem) =>
                            (typeof item === "string"
                                ? item
                                : item.address
                            )?.toLowerCase() === newAddress.toLowerCase()
                    )
                ) {
                    toast.info("Adresse déjà enregistrée")
                    return
                }
                await update_fiche_client({
                    id: client,
                    adresse_livraison: [
                        ...oldHistory,
                        {
                            address: newAddress,
                            label: "Livraison",
                            date: new Date().toISOString(),
                        },
                    ],
                })
                toast.success("Adresse ajoutée au carnet")
            } catch {
                toast.error("Erreur lors de la sauvegarde")
            }
        },
        [client, selectedClient, update_fiche_client]
    )

    const removeAddressFromHistory = useCallback(
        async (addrToDelete: string) => {
            if (!client || !selectedClient || !update_fiche_client) return
            try {
                const oldHistory = Array.isArray(
                    selectedClient.adresse_livraison
                )
                    ? selectedClient.adresse_livraison
                    : []
                const newHistory = oldHistory.filter(
                    (item: AddressHistoryItem) =>
                        (typeof item === "string"
                            ? item
                            : item.address
                        )?.toLowerCase() !== addrToDelete.toLowerCase()
                )
                await update_fiche_client({
                    id: client,
                    adresse_livraison: newHistory,
                })
                toast.success("Adresse retirée")
                if (adresseLivraison === addrToDelete) setAdresseLivraison("")
            } catch {
                toast.error("Erreur lors de la suppression")
            }
        },
        [client, selectedClient, update_fiche_client, adresseLivraison]
    )

    return {
        adresseLivraison,
        setAdresseLivraison,
        adresseFacturation,
        setAdresseFacturation,
        savedAddresses,
        addAddressToHistory,
        removeAddressFromHistory,
    }
}

// ==========================================
// 🧠 LE PROVIDER PRINCIPAL
// ==========================================
export function DevisProvider({ children }: { children: ReactNode }) {
    const { clients, Produit, Info, Update, update_fiche_client } =
        useCRMContext()

    const { user } = useAuth()
    const { fournisseurs, fetch_Fournisseur } = UseFournisseur()
    // --- ETATS GLOBAUX ---
    const [client, setClient] = useState("")
    const [creator, setCreator] = useState<string>("")
    const [siret, setSiret] = useState<string | undefined>("")
    const [status, setStatus] = useState("")
    const [note, setNote] = useState("")
    const [urgence, setUrgence] = useState<UrgenceLevel>("normale")

    // Le numéro de devis ne doit être généré qu'une seule fois à la création
    const [numeroDevis, setNumeroDevis] = useState(generateNumeroDevis)

    // Le client du devis (y compris un devis ancien rouvert) est chargé dans le
    // stock commun : `clients.find` ci-dessous et dans les panneaux du devis
    // le trouvent même hors des listes déjà chargées.
    useClientById(client)
    const selectedClient = useMemo(
        () => clients.find((c) => c.id === client),
        [clients, client]
    )

    const isPDFDisabled = !selectedClient || !selectedClient.siret

    // --- GESTION DES PRODUITS ---
    const [products, setProducts] = useState<QuoteProduct[]>([])
    const [remises, setRemises] = useState<QuoteProduct[]>([])
    const [inputValue, setInputValue] = useState("")
    const [checked, setChecked] = useState(false)
    const [checkedKil, setCheckedKil] = useState(false)
    const [maxQuantity, setMaxQuantity] = useState<number | undefined>(
        undefined
    )

    const filtered = useMemo(() => {
        if (!inputValue) return []
        const lowerInput = inputValue.toLowerCase()
        return Produit.filter(
            (p) =>
                p.name.toLowerCase().includes(lowerInput) &&
                (checked
                    ? p.categorie === "HandPick"
                    : p.categorie === "Entrepôt")
        )
    }, [Produit, inputValue, checked])

    const totals = useMemo(() => {
        // 1. Calcul des bases HT et TVA pour les produits
        const productsHT = products.reduce(
            (sum, p) => sum + (p.totalHT || 0),
            0
        )
        const productsTVA = products.reduce(
            (sum, p) => sum + (p.totalTVA || 0),
            0
        )

        // 2. Calcul des bases HT et TVA pour les remises (qui sont souvent négatives)
        const remisesHT = remises.reduce((sum, r) => sum + (r.totalHT || 0), 0)
        const remisesTVA = remises.reduce(
            (sum, r) => sum + (r.totalTVA || 0),
            0
        )

        // 3. Somme intermédiaire
        const totalHTFinal = productsHT + remisesHT
        const totalTVAFinal = productsTVA + remisesTVA

        // 4. Calcul du TTC à partir du HT et de la TVA arrondis
        // On arrondit d'abord les composants pour éviter les erreurs de centimes
        const roundedHT = round2(totalHTFinal)
        const roundedTVA = round2(totalTVAFinal)

        // Le TTC est la somme du HT arrondi et de la TVA arrondie
        const totalTTCFinal = round2(roundedHT + roundedTVA)

        return {
            totalHT: roundedHT,
            totalTVA: roundedTVA,
            totalTTC: totalTTCFinal,
        }
    }, [products, remises])

    // --- DATES, FINANCES & OPTIONS ---
    const [datedesaisis, setDatedesaisis] = useState(
        new Date().toISOString().split("T")[0]
    )
    const [expirationDate, setExpirationDate] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() + 3)
        return d.toISOString().split("T")[0]
    })
    const [mode, setMode] = useState<"" | "remise" | "nouveau" | "existant">("")
    const [discountType, setDiscountType] = useState<"percent" | "fixed">(
        "percent"
    )
    const [discountPercent, setDiscountPercent] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState("")
    const [payments, setPayments] = useState<
        { method: string; amount: number }[]
    >([])
    const [AvoirValue, setAvoirValue] = useState<number>(0)
    const [Livraison, setLivraison] = useState("Exworks")
    const setLivraisonMethod = setLivraison
    const [TVA, setTVA] = useState("20")
    const [TvaNumber, setTvaNumber] = useState("")

    // 🧩 Injection du Sub-Hook des adresses
    const addressLogic = useDevisAddresses(
        client,
        selectedClient,
        update_fiche_client
    )

    // --- ACTIONS GLOBAUX ---
    const loadQuoteData = useCallback((quote: LegacyQuoteRow | Devis) => {
        const q = quote as Record<string, unknown>
        const str = (k: string) =>
            typeof q[k] === "string" ? (q[k] as string) : undefined
        const num = (k: string) =>
            typeof q[k] === "number" ? (q[k] as number) : undefined

        if (str("client")) setClient(str("client")!)
        if (str("Date_crea"))
            setDatedesaisis(
                new Date(str("Date_crea")!).toISOString().split("T")[0]
            )
        if (str("Date_end")) setExpirationDate(str("Date_end")!)

        if (Array.isArray(q.Tableau)) {
            const rows = q.Tableau as Array<Record<string, unknown>>
            setProducts(
                rows.map((p) => {
                    const qty = Number(p.qty ?? 0) || 0
                    const price = Number(p.price ?? p.prix ?? 0) || 0
                    const tva = Number(p.tva ?? p.TVA ?? 0) || 0
                    const weight = Number(p.weight ?? p.poid ?? 0) || 0
                    const mode = (p.mode as QuoteProduct["mode"]) || "Pièce"
                    const totalHT = qty * price
                    return {
                        id:
                            (p.id as string) ||
                            Math.random().toString(),
                        name:
                            (p.name as string) ||
                            (p.produit as string) ||
                            "",
                        description: (p.description as string) || "",
                        qty,
                        price,
                        tva,
                        weight,
                        mode,
                        totalHT,
                        totalTVA: totalHT * (tva / 100),
                        totalTTC: totalHT * (1 + tva / 100),
                    } satisfies QuoteProduct
                })
            )
        } else setProducts([])

        setStatus(str("status") || "Brouillon")
        setNote(str("termes") || "")
        setLivraisonMethod(str("Livraison") || "Exworks")
        setTVA(String(num("TVA") ?? "20"))
        setTvaNumber(str("TvaNumber") || "")
        setCreator(str("by") || "")
        setAvoirValue(num("Avoir") || 0)
        setChecked(str("service") === "Handpick")
        const urg = str("urgence")
        if (urg === "haute" || urg === "élevée") setUrgence(urg as UrgenceLevel)
        else setUrgence("normale")

        try {
            setPayments(
                Array.isArray(q.paiement)
                    ? (q.paiement as { method: string; amount: number }[])
                    : JSON.parse((q.paiement as string) || "[]")
            )
        } catch {
            setPayments([])
        }
        try {
            setRemises(
                Array.isArray(q.Remise)
                    ? (q.Remise as QuoteProduct[])
                    : JSON.parse((q.Remise as string) || "[]")
            )
        } catch {
            setRemises([])
        }
    }, [])

    // Remise à zéro complète de tous les états du bon (création d'un nouveau).
    // Centralisé ici pour garantir qu'aucune valeur ne fuite d'un bon à l'autre.
    const resetDevis = useCallback(() => {
        // Identité / méta
        setNumeroDevis(generateNumeroDevis())
        setClient("")
        setSiret("")
        setStatus("Envoyé")
        setCreator(user?.user_id || "")
        setUrgence("normale")

        // Dates
        setDatedesaisis(new Date().toISOString().split("T")[0])
        setExpirationDate(() => {
            const d = new Date()
            d.setMonth(d.getMonth() + 3)
            return d.toISOString().split("T")[0]
        })

        // Produits / remises / saisie
        setProducts([])
        setRemises([])
        setInputValue("")
        setChecked(false)
        setCheckedKil(false)
        setMaxQuantity(undefined)
        setMode("")
        setDiscountType("percent")
        setDiscountPercent(0)

        // Paiement / TVA / avoir
        setPayments([])
        setPaymentMethod("")
        setAvoirValue(0)
        setTVA("20")
        setTvaNumber("")

        // Livraison / note / adresses
        setLivraisonMethod("Exworks")
        setNote("")
        addressLogic.setAdresseLivraison("")
        addressLogic.setAdresseFacturation("")
    }, [user, addressLogic])

    const prepareDevis = useCallback((): Devis => {
        const payload = {
            ...(Update && Info
                ? { id: Info.id, name: Info.name }
                : { name: numeroDevis }),
            client,
            client_crm: selectedClient,
            by: creator || "unknown",
            Date_crea: datedesaisis,
            Tableau: products.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                qty: p.qty,
                price: round2(p.price),
                tva: Number(p.tva) || 0,
                weight: round2(p.weight),
                mode: p.mode,
                totalHT: p.totalHT,
                totalTVA: p.totalTVA,
                totalTTC: p.totalTTC,
            })),
            poid: round2(products.reduce((sum, p) => sum + (p.weight || 0), 0)),
            totalHT: totals.totalHT,
            totalTVA: totals.totalTVA,
            totalTTC: totals.totalTTC,
            termes: note,
            paiement: payments,
            status,
            TVA: Number(TVA),
            TvaNumber,
            Livraison,
            service: checked ? "Handpick" : "Entrepôt",
            Avoir: AvoirValue,
            Remise: remises || [],
            urgence,
        }
        return payload as unknown as Devis
    }, [
        Update,
        Info,
        numeroDevis,
        client,
        selectedClient,
        creator,
        datedesaisis,
        products,
        totals,
        note,
        payments,
        status,
        TVA,
        TvaNumber,
        Livraison,
        checked,
        AvoirValue,
        remises,
        urgence,
    ])

    // --- 🚨 OPTIMISATION MAJEURE ICI 🚨 ---
    // Mémorisation du contexte pour éviter de forcer le rendu des enfants
    // si aucune des variables n'a changé.
    const contextValue = useMemo<DevisContextType>(
        () => ({
            client,
            setClient,
            user: user || null,
            creator,
            setCreator,
            isPDFDisabled,
            products,
            setProducts,
            inputValue,
            setInputValue,
            filtered,
            datedesaisis,
            setDatedesaisis,
            expirationDate,
            setExpirationDate,
            mode,
            setMode,
            discountType,
            setDiscountType,
            discountPercent,
            setDiscountPercent,
            paymentMethod,
            setPaymentMethod,
            Livraison,
            setLivraisonMethod,
            note,
            setNote,
            ...addressLogic, // Déstructuration des adresses (mémorisées en amont)
            TVA,
            setTVA,
            TvaNumber,
            setTvaNumber,
            status,
            setStatus,
            checked,
            setChecked,
            checkedKil,
            setCheckedKil,
            maxQuantity,
            setMaxQuantity,
            payments,
            setPayments,
            AvoirValue,
            setAvoirValue,
            remises,
            setRemises,
            numeroDevis,
            round2,
            totals,
            prepareDevis,
            loadQuoteData,
            resetDevis,
            siret,
            setSiret,
            fournisseurs,
            fetch_Fournisseur,
            urgence,
            setUrgence,
        }),
        [
            client,
            user,
            creator,
            isPDFDisabled,
            products,
            inputValue,
            filtered,
            datedesaisis,
            expirationDate,
            mode,
            discountType,
            discountPercent,
            paymentMethod,
            Livraison,
            note,
            addressLogic,
            TVA,
            TvaNumber,
            status,
            checked,
            checkedKil,
            maxQuantity,
            payments,
            AvoirValue,
            remises,
            numeroDevis,
            totals,
            prepareDevis,
            loadQuoteData,
            resetDevis,
            siret,
            fournisseurs,
            fetch_Fournisseur,
            urgence,
        ]
    )

    return (
        <DevisContext value={contextValue}>
            {children}
        </DevisContext>
    )
}

export function useDevisContext() {
    const context = use(DevisContext)
    if (!context)
        throw new Error("useDevisContext must be used inside a DevisProvider")
    return context
}
