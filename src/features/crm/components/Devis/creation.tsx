import { useState, useEffect, useRef } from "react"

import QuoteHeader from "./Creation_Split/firstrow"

import ProductInput from "./Creation_Split/produit"

import ProductTable from "./Creation_Split/TableauProd"

import DevisActions from "./Creation_Split/action"

import { useCRMContext } from "../../context/CRMContext"

import { useDevisContext } from "../../context/DevisContext"

import PaymentsSummary from "./Creation_Split/paiementtab"

import LivraisonChoice from "./Creation_Split/livraison_choice"

import {
    FileText,
    PanelRightClose,
    PanelRightOpen,
    ChevronDown,
    X,
} from "lucide-react"

import { Button } from "@/shared/ui/atoms/button"

import { cn } from "@/shared/lib/utils"

// --- IMPORTS SHADCN DIALOG ---

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/ui/atoms/dialog"

// QuoteProduct est défini dans le fichier de types partagés et re-exporté ici

// pour la rétro-compatibilité des imports existants.

export type { QuoteProduct } from "@/features/crm/types"

export default function CreateDevis() {
    const [isInfoOpen, setIsInfoOpen] = useState(true)

    const { setCreationDevis, setIsSidebarOpen, isSidebarOpen, enableProducts } =
        useCRMContext()

    // La saisie de devis a besoin du catalogue produits (différé hors flux devis).
    useEffect(() => {
        enableProducts()
    }, [enableProducts])

    const { numeroDevis, totals } = useDevisContext()

    // Ouverture/fermeture animée de la colonne panier — même recette que
    // CalendarSidebar (sidebar_event.tsx) : `isSidebarOpen` (contexte global)
    // pilote juste l'intention, `shouldRender` garde le panneau monté le
    // temps de l'animation de sortie, `isExpanded` porte la largeur réelle
    // et n'est mis à `true` qu'un frame APRÈS le montage (double rAF), sinon
    // le premier rendu peint déjà la largeur finale et l'ouverture ne
    // s'anime pas.
    const [shouldRenderSidebar, setShouldRenderSidebar] =
        useState(isSidebarOpen)
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
    const sidebarRafRef = useRef(0)

    useEffect(() => {
        if (!isSidebarOpen) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- collapse la largeur sur fermeture, l'élément est déjà peint à sa largeur finale donc la transition anime bien
            setIsSidebarExpanded(false)
            return
        }
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resynchronise le montage sur la réouverture, ne peut pas être dérivé au rendu
        setShouldRenderSidebar(true)
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
                setIsSidebarExpanded(true)
            })
            sidebarRafRef.current = raf2
        })
        sidebarRafRef.current = raf1
        return () => cancelAnimationFrame(sidebarRafRef.current)
    }, [isSidebarOpen])

    // Fermé par défaut : la barre récap + Brouillon + Poids pesé + boutons est
    // repliée au départ (seul l'entête Total TTC est visible) et se déplie au clic.
    const [isActionsOpen, setIsActionsOpen] = useState(false)

    // --- CLAVIER TABLETTE : remonte l'éditeur au-dessus du clavier ---
    // Sans cela, à la recherche d'un client le clavier virtuel recouvre le champ
    // et le menu de résultats. On cale la modale dans la zone visible (visualViewport)
    // et on limite sa hauteur quand le clavier est ouvert.
    const [kb, setKb] = useState({ inset: 0, height: 0, top: 0 })
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return
        const onResize = () => {
            const inset = Math.max(
                0,
                window.innerHeight - vv.height - vv.offsetTop
            )
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- synchronisation sur une source externe (visualViewport), pas une dérivation d'état rendu
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
    const keyboardDialogStyle =
        kb.inset > 0
            ? { top: kb.top + kb.height / 2, maxHeight: kb.height - 16 }
            : undefined

    // Gestion de la fermeture

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setCreationDevis(false)
        }
    }

    return (
        <Dialog open={true} onOpenChange={handleOpenChange}>
            <DialogContent
                className="w-[95vw] sm:w-[90vw] max-w-[1400px] h-[90vh] sm:h-[85vh] p-0 gap-0 bg-background/95 backdrop-blur-xl border-white/20 shadow-2xl overflow-hidden flex flex-col [&>button]:hidden"
                style={keyboardDialogStyle}
            >
                {/* [&>button]:hidden -> Cache la croix par défaut de Shadcn pour utiliser la nôtre */}

                {/* HEADER */}

                <div className="flex justify-between items-center px-3 sm:px-6 py-3 sm:py-4 border-b bg-transparent shrink-0">
                    <DialogHeader className="flex flex-row items-center gap-2 sm:gap-3 space-y-0 text-left overflow-hidden pr-2">
                        <div className="bg-primary/10 p-1.5 sm:p-2 rounded-lg text-primary shrink-0">
                            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>

                        {/* min-w-0 est crucial ici pour que le truncate fonctionne dans un flex */}

                        <div className="min-w-0">
                            <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">
                                Éditeur de Bon de Commande
                            </DialogTitle>

                            <DialogDescription className="text-xs sm:text-sm text-muted-foreground font-mono mt-0 truncate">
                                #{numeroDevis}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    {/* GROUPE DE BOUTONS DROITE - shrink-0 empêche l'écrasement */}

                    <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            title={
                                isSidebarOpen
                                    ? "Fermer le résumé"
                                    : "Ouvrir le résumé"
                            }
                            className="bg-background/50 h-8 w-8 sm:h-9 sm:w-9"
                        >
                            {isSidebarOpen ? (
                                <PanelRightClose className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                            ) : (
                                <PanelRightOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            )}
                        </Button>

                        <div className="h-5 sm:h-6 w-px bg-border mx-0.5 sm:mx-1" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCreationDevis(false)}
                            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {/* flex plutôt que grid grid-cols-12 : un swap discret de
                        lg:col-span-8/12 ne s'anime pas de façon fiable en CSS.
                        La colonne gauche reste flex-1 (s'ajuste automatiquement
                        à la largeur réellement animée de la colonne panier). */}
                    <div className="h-full flex flex-col lg:flex-row">
                        {/* COLONNE GAUCHE (Contenu principal) */}

                        <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden lg:border-r border-border">
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 scrollbar-thin">
                                {/* --- SECTION 1: Infos Client --- */}

                                <div className="border rounded-md bg-card/60 shadow-sm overflow-hidden">
                                    <div
                                        className="flex items-center justify-between px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                                        onClick={() =>
                                            setIsInfoOpen(!isInfoOpen)
                                        }
                                    >
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">
                                                1
                                            </span>
                                            Informations Générales
                                        </h3>

                                        <ChevronDown
                                            className={cn(
                                                "w-4 h-4 text-muted-foreground transition-transform duration-base",

                                                isInfoOpen
                                                    ? "rotate-180"
                                                    : "rotate-0"
                                            )}
                                        />
                                    </div>

                                    {isInfoOpen && (
                                        <div className="p-4 pt-2 border-t bg-background/40 animate-in slide-in-from-top-1 duration-base">
                                            <QuoteHeader />
                                        </div>
                                    )}
                                </div>

                                {/* --- SECTION 2: Produits (cœur de la saisie) --- */}

                                <div className="flex flex-col gap-3">
                                    <div className="space-y-2 px-1">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">
                                                2
                                            </span>
                                            Catalogue & Panier
                                        </h3>

                                        <ProductInput />
                                    </div>

                                    <div className="rounded-md border bg-card/60 shadow-sm overflow-hidden">
                                        <ProductTable />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COLONNE DROITE (Sidebar / Panier) */}

                        {shouldRenderSidebar && (
                            <div
                                onTransitionEnd={() => {
                                    if (!isSidebarOpen)
                                        setShouldRenderSidebar(false)
                                }}
                                onAnimationEnd={() => {
                                    if (!isSidebarOpen)
                                        setShouldRenderSidebar(false)
                                }}
                                className={cn(
                                    "absolute inset-0 z-50 bg-background lg:bg-muted/10",

                                    "lg:static lg:z-auto lg:overflow-hidden",
                                    "lg:transition-[width] lg:duration-slow lg:ease-out lg:will-change-[width]",
                                    isSidebarExpanded
                                        ? "lg:w-[380px]"
                                        : "lg:w-0",

                                    "flex flex-col h-full lg:border-l border-border",

                                    isSidebarOpen
                                        ? "animate-in slide-in-from-right-2 lg:fade-in duration-slow"
                                        : "animate-out slide-out-to-right-2 lg:fade-out duration-slow",
                                    "shadow-2xl lg:shadow-none"
                                )}
                            >
                                {/* Contenu interne largeur fixe : ne se déforme pas
                                    pendant l'animation de largeur du conteneur */}
                                <div className="flex flex-col h-full lg:w-[380px] [contain:layout_paint]">
                                    {/* Barre de navigation mobile — cachée sur desktop */}

                                    <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b shrink-0 bg-background/95 backdrop-blur-md sticky top-0 z-20">
                                        <h3 className="font-bold text-base text-foreground">
                                            Récapitulatif & Validation
                                        </h3>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setIsSidebarOpen(false)
                                            }
                                            className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted"
                                        >
                                            <X className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    {/* Contenu scrollable */}

                                    <div className="flex-1 overflow-y-auto p-4 lg:p-4 space-y-4 scrollbar-thin">
                                        <PaymentsSummary />

                                        {/* Choix simplifié du mode de livraison, sous le Ticket */}
                                        <LivraisonChoice />
                                    </div>

                                    {/* Barre d'action collée en bas (Sticky Bottom) */}

                                    <div className="shrink-0 border-t bg-background/95 backdrop-blur-md sticky bottom-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] pb-safe">
                                    {/* Entête de repli (tous formats) : Total TTC + chevron */}
                                    <div
                                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                                        onClick={() =>
                                            setIsActionsOpen(!isActionsOpen)
                                        }
                                        title={
                                            isActionsOpen
                                                ? "Replier le récapitulatif"
                                                : "Déplier le récapitulatif"
                                        }
                                    >
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                                Total TTC
                                            </p>
                                            <p className="text-xl font-extrabold text-primary font-mono leading-tight">
                                                {totals.totalTTC.toFixed(2)} €
                                            </p>
                                        </div>
                                        <ChevronDown
                                            className={cn(
                                                "w-5 h-5 text-muted-foreground transition-transform duration-base",
                                                isActionsOpen
                                                    ? "rotate-180"
                                                    : "rotate-0"
                                            )}
                                        />
                                    </div>

                                    {/* Bloc récap + Brouillon + Poids pesé + boutons — repliable verticalement sur tous les formats */}
                                    <div
                                        className={cn(
                                            "p-3 sm:p-4",
                                            isActionsOpen ? "block" : "hidden"
                                        )}
                                    >
                                        <DevisActions
                                            onCollapse={() =>
                                                setIsActionsOpen(false)
                                            }
                                        />
                                    </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
