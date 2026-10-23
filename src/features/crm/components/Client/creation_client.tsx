import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/ui/atoms/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    User,
    Phone,
    Mail,
    MapPin,
    Building2,
    Instagram,
    Trash2,
    Loader2,
    ExternalLink,
    Check,
} from "lucide-react"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { capitalizeName } from "@/features/crm/utils/capitalizeName"

export default function CreateClientCard({
    setCreationclient,
    client,
}: {
    setCreationclient: (value: boolean) => void
    client?: Client | null
}) {
    const {
        create_fiche_client,
        update_fiche_client,
        setClientToOpen,
        delete_fiche_client,
    } = useCRMContext()

    // --- STATES ---
    const [siret, setSiret] = useState(client?.siret || "")
    const [prenom, setPrenom] = useState(
        client?.nom?.includes(" ") ? client.nom.split(" ")[0] : ""
    )
    const [nom, setNom] = useState(
        client?.nom?.includes(" ")
            ? client.nom.split(" ")[1]
            : client?.nom || ""
    )
    const [societe, setSociete] = useState(client?.societe || "")
    const [telephone, setTelephone] = useState(client?.telephone || "")
    const [telephone_2, setTelephone_2] = useState(client?.telephone_2 || "")
    const [mail, setMail] = useState(client?.mail || "")
    const [mail_2, setMail_2] = useState(client?.mail_2 || "")
    const [insta, setInsta] = useState(client?.insta || "")
    const [localisation, setLocalisation] = useState(client?.localisation || "")
    const [TVA, setTVA] = useState(client?.numero_TVA || "")

    // États de chargement et validation
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    // Validation SIRET
    const [isLoadingSiret, setIsLoadingSiret] = useState(false)
    const [isSiretValid, setIsSiretValid] = useState(!!client?.siret)

    // Validation TVA
    const [isLoadingTva] = useState(false)
    const [isTvaValid, setIsTvaValid] = useState(!!client?.numero_TVA)

    // --- CLAVIER TABLETTE/MOBILE ---
    // Quand le clavier virtuel s'ouvre, le layout viewport ne rétrécit pas : la
    // modale (centrée) garde sa hauteur et son pied (bouton de validation) passe
    // sous le clavier. On mesure le visualViewport pour, le cas échéant, contraindre
    // la hauteur de la modale à la zone visible et la recentrer dedans.
    const [kb, setKb] = useState({ inset: 0, height: 0, top: 0 })
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return
        const onResize = () => {
            const inset = Math.max(
                0,
                window.innerHeight - vv.height - vv.offsetTop
            )
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- mesure du visualViewport (DOM), non dérivable
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

    // Style appliqué à la modale quand le clavier est ouvert : on la cale dans la
    // zone visible (top = centre de la zone visible, la transform translate(-50%)
    // de Radix faisant le reste) et on limite sa hauteur pour garder le pied visible.
    const keyboardDialogStyle =
        kb.inset > 0
            ? { top: kb.top + kb.height / 2, maxHeight: kb.height - 16 }
            : undefined

    // --- FONCTION API VIA SIRET ---
    const recupererDonneesViaSiret = async (currentSiret: string) => {
        setIsLoadingSiret(true)
        setIsSiretValid(false)

        try {
            const url = `https://info.nokk-project.example/api/entreprise/${currentSiret}`

            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            })

            if (!response.ok) return

            const data = await response.json()

            // Mapping
            if (data.denomination) setSociete(data.denomination)
            else if (data.nom_complet) setSociete(data.nom_complet)

            if (data.tva) {
                setTVA(data.tva)
                setIsTvaValid(true) // Si l'API renvoie la TVA, on la valide
            }

            if (data.adresse_postale_legale) {
                const { ville, code_postal } = data.adresse_postale_legale
                const loc = [ville, code_postal].filter(Boolean).join(" ")
                setLocalisation(loc)
            }

            setIsSiretValid(true)
        } catch (erreur) {
            console.error("💥 Erreur API SIRET :", erreur)
        } finally {
            setIsLoadingSiret(false)
        }
    }

    // --- USE EFFECTS (DEBOUNCE) ---

    // 1. Watch SIRET
    useEffect(() => {
        if (!siret || siret.length < 9) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- validité SIRET aussi mise à jour de façon asynchrone (API debounce)
            setIsSiretValid(false)
            return
        }
        if (client?.siret === siret) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- validité SIRET aussi mise à jour de façon asynchrone (API debounce)
            setIsSiretValid(true)
            return
        }
        const delay = setTimeout(() => recupererDonneesViaSiret(siret), 1000)
        return () => clearTimeout(delay)
    }, [siret, client?.siret])

    // --- HANDLERS ---
    const handleSiretChange = (value: string) => {
        setSiret(value.replace(/\D/g, ""))
        if (isSiretValid) setIsSiretValid(false)
    }

    const handleTvaChange = (value: string) => {
        setTVA(value.toUpperCase()) // Force majuscule
        if (isTvaValid) setIsTvaValid(false)
    }

    const isDisabled = !nom || (!telephone && !telephone_2) || isSubmitting
    const isMailInvalid = mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)
    const isMail2Invalid = mail_2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail_2)

    const handleSubmit = async () => {
        if (mail_2 !== "" && isMail2Invalid) return
        if (isMailInvalid) return
        setIsSubmitting(true)

        const cleanPrenom = capitalizeName(prenom.trim())
        const cleanNom = capitalizeName(nom.trim())

        let name = ""
        if (cleanNom && cleanPrenom) name = cleanPrenom + " " + cleanNom
        else if (cleanNom) name = cleanNom

        const newClient: Client = {
            nom: name || cleanPrenom,
            societe,
            siret,
            telephone: telephone || null,
            telephone_2: telephone_2 || null,
            mail,
            mail_2: mail_2 || null,
            localisation,
            insta,
            numero_TVA: TVA,
            collum: client?.collum || 1,
        }
        //
        let savedClient
        try {
            if (!client?.id) {
                savedClient = await create_fiche_client(newClient)
            } else {
                // `customer`/`closers` sont typés string|null côté payload DB
                // (vs Owner côté Client) ; newClient ne les renseigne pas, on
                // restreint donc le type au sous-ensemble réellement transmis.
                const changes: Partial<Client> & {
                    id: string
                    customer?: string | null
                    closers?: string | null
                } = {
                    ...newClient,
                    customer: undefined,
                    closers: undefined,
                    id: client.id,
                }
                savedClient = await update_fiche_client(changes)
            }

            if (savedClient)
                setClientToOpen(savedClient as unknown as ClientTypes)
            setCreationclient(false)
        } catch (error) {
            console.error("❌ Erreur sauvegarde client:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        await delete_fiche_client(client?.id || "")
        setCreationclient(false)
    }

    return (
        <>
            <Dialog
                open={true}
                onOpenChange={(open) => !open && setCreationclient(false)}
            >
                <DialogContent
                    className="w-[95vw] sm:max-w-[700px] max-h-[90dvh] p-0 gap-0 flex flex-col overflow-hidden"
                    style={keyboardDialogStyle}
                >
                    {/* HEADER */}
                    <div className="bg-muted/30 p-4 sm:p-6 border-b shrink-0">
                        <DialogHeader>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                    <User className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <DialogTitle className="text-xl">
                                        {client?.id
                                            ? "Modifier le client"
                                            : "Nouveau client"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Remplissez les informations ci-dessous.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div
                        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6"
                        onFocusCapture={(e) => {
                            const target = e.target as HTMLElement
                            // Laisse le clavier s'ouvrir avant de recentrer le champ.
                            setTimeout(
                                () =>
                                    target.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                    }),
                                300
                            )
                        }}
                    >
                        {/* IDENTITÉ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Prénom</Label>
                                <Input
                                    value={prenom}
                                    onChange={(e) => setPrenom(e.target.value)}
                                    placeholder="Jean"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Nom <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={nom}
                                    onChange={(e) => setNom(e.target.value)}
                                    placeholder="Dupont"
                                    required
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* SOCIÉTÉ */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Building2 className="w-4 h-4" /> Informations
                                Société
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* SOCIETE */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center h-5">
                                        <Label>Société</Label>
                                    </div>
                                    <Input
                                        value={societe}
                                        onChange={(e) =>
                                            setSociete(e.target.value)
                                        }
                                        placeholder="Nom de la société"
                                    />
                                </div>

                                {/* SIRET */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center h-5">
                                        <Label
                                            className={
                                                isSiretValid
                                                    ? "text-success"
                                                    : ""
                                            }
                                        >
                                            SIRET
                                        </Label>
                                        <a
                                            href="https://www.sirene.fr/sirene/public/accueil"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                        >
                                            Vérifier{" "}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            value={siret}
                                            onChange={(e) =>
                                                handleSiretChange(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Numéro SIRET"
                                            inputMode="numeric"
                                            className={`transition-colors duration-slow ${
                                                isLoadingSiret || isSiretValid
                                                    ? "pr-9"
                                                    : ""
                                            } ${
                                                isSiretValid
                                                    ? "border-success focus-visible:ring-success bg-success/10 text-foreground"
                                                    : ""
                                            }`}
                                        />
                                        {isLoadingSiret && (
                                            <div className="absolute right-3 top-2.5">
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            </div>
                                        )}
                                        {!isLoadingSiret && isSiretValid && (
                                            <div className="absolute right-3 top-2.5">
                                                <Check className="h-4 w-4 text-success" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* NOUVELLE LIGNE : TVA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center h-5">
                                        <Label
                                            className={
                                                isTvaValid
                                                    ? "text-success"
                                                    : ""
                                            }
                                        >
                                            N° TVA Intracom
                                        </Label>
                                        <a
                                            href="https://ec.europa.eu/taxation_customs/vies/#/vat-validation"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                        >
                                            Vérifier{" "}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            value={TVA}
                                            onChange={(e) =>
                                                handleTvaChange(e.target.value)
                                            }
                                            placeholder="FR..."
                                            className={`transition-colors duration-slow uppercase placeholder:normal-case ${
                                                isLoadingTva || isTvaValid
                                                    ? "pr-9"
                                                    : ""
                                            } ${
                                                isTvaValid
                                                    ? "border-success focus-visible:ring-success bg-success/10 text-foreground"
                                                    : ""
                                            }`}
                                        />
                                        {isLoadingTva && (
                                            <div className="absolute right-3 top-2.5">
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            </div>
                                        )}
                                        {!isLoadingTva && isTvaValid && (
                                            <div className="absolute right-3 top-2.5">
                                                <Check className="h-4 w-4 text-success" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Espace vide pour équilibrer la grille ou autre champ futur */}
                                <div></div>
                            </div>
                        </div>

                        <Separator />

                        {/* CONTACT */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Phone className="w-4 h-4" /> Coordonnées
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>
                                        Ligne Personnelle{" "}
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-9"
                                            value={telephone}
                                            onChange={(e) =>
                                                setTelephone(e.target.value)
                                            }
                                            placeholder="06 12 34 56 78"
                                        />
                                    </div>
                                    <Label>
                                        Ligne Professionnelle{" "}
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-9"
                                            value={telephone_2}
                                            onChange={(e) =>
                                                setTelephone_2(e.target.value)
                                            }
                                            placeholder="06 12 34 56 78"
                                        />
                                    </div>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        * Au moins une des deux lignes est
                                        requise
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    {/* Mail Personnel */}
                                    <div className="space-y-2">
                                        <Label htmlFor="mail">
                                            Mail Personnel
                                        </Label>
                                        <div className="relative">
                                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="mail"
                                                className={`pl-9 ${isMailInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                                type="email"
                                                value={mail}
                                                onChange={(e) =>
                                                    setMail(e.target.value)
                                                }
                                                placeholder="nom@exemple.com"
                                            />
                                        </div>
                                        {isMailInvalid && (
                                            <p className="text-[0.8rem] font-medium text-destructive">
                                                Email personnel invalide
                                            </p>
                                        )}
                                    </div>

                                    {/* Mail Professionnel */}
                                    <div className="space-y-2">
                                        <Label htmlFor="mail_prof">
                                            Mail Professionnel
                                        </Label>
                                        <div className="relative">
                                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="mail_prof"
                                                className={`pl-9 ${isMail2Invalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                                type="email"
                                                value={mail_2}
                                                onChange={(e) =>
                                                    setMail_2(e.target.value)
                                                }
                                                placeholder="contact@entreprise.com"
                                            />
                                        </div>
                                        {isMail2Invalid && (
                                            <p className="text-[0.8rem] font-medium text-destructive">
                                                Email professionnel invalide
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Adresse</Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-9"
                                            value={localisation}
                                            onChange={(e) =>
                                                setLocalisation(e.target.value)
                                            }
                                            placeholder="12 rue de l'Exemple, 75000 Paris"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Instagram</Label>
                                    <div className="relative">
                                        <Instagram className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-9"
                                            value={insta}
                                            onChange={(e) =>
                                                setInsta(e.target.value)
                                            }
                                            placeholder="@pseudo"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="bg-background p-4 sm:p-6 border-t shrink-0">
                        <DialogFooter className="flex items-center justify-between sm:justify-between gap-4 w-full">
                            {client?.id ? (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setShowDeleteDialog(true)}
                                    className="gap-2"
                                >
                                    <Trash2 className="w-4 h-4" /> Supprimer
                                </Button>
                            ) : (
                                <div />
                            )}

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setCreationclient(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isDisabled}
                                    loading={isSubmitting}
                                >
                                    {!client?.id ? "Créer" : "Enregistrer"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer ce client ?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-sm">
                                <p>
                                    Cette action est conforme au RGPD et est
                                    irréversible.
                                </p>
                                <div>
                                    <p className="font-medium text-foreground mb-1">
                                        Anonymisé (données comptables
                                        conservées) :
                                    </p>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                        <li>
                                            Devis et bons de commande (lien
                                            client supprimé)
                                        </li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium text-foreground mb-1">
                                        Supprimé définitivement :
                                    </p>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                        <li>
                                            Fiche client et données personnelles
                                        </li>
                                        <li>Activités et historique</li>
                                        <li>Tâches associées</li>
                                        <li>Événements agenda</li>
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
