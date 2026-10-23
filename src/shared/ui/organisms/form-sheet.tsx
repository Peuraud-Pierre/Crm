import { createElement, isValidElement, useState, type ReactNode } from "react"
import type { ReactElement } from "react"
import type { LucideIcon } from "lucide-react"
import { Trash2 } from "lucide-react"
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
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { cn } from "@/shared/lib/utils"

interface FormSheetProps {
    open: boolean
    onClose: () => void

    /**
     * Contenu de la pastille d'en-tête. Un composant Lucide est rendu à la
     * bonne taille et à la couleur d'accent ; un élément déjà construit est
     * rendu tel quel, ce qui permet à une sheet de porter une icône déjà
     * colorée (le type d'entité d'une entrée de journal, par exemple).
     */
    icon: LucideIcon | ReactElement
    title: ReactNode
    description?: ReactNode

    /**
     * Soumission. Fournie, le corps est rendu dans un vrai `<form>` : la touche
     * Entrée valide, et le bouton principal est un `type="submit"`. Omise, la
     * sheet est en lecture seule (pas de pied de page d'action).
     */
    onSubmit?: () => void | Promise<void>
    submitLabel?: string
    submitDisabled?: boolean
    loading?: boolean
    cancelLabel?: string

    /**
     * Action destructive, isolée à gauche du pied de page.
     *
     * Elle passe TOUJOURS par une confirmation : le bouton est une icône
     * discrète, à quelques pixels d'« Annuler », et la plupart des suppressions
     * de ce dépôt sont irréversibles. Personne ne doit perdre un arrivage en
     * visant le mauvais bouton.
     */
    onDelete?: () => void | Promise<void>
    deleteLabel?: string
    /** Textes du dialogue de confirmation. */
    deleteConfirm?: {
        title: ReactNode
        /** Ce que la suppression emporte avec elle. */
        description?: ReactNode
        confirmLabel?: string
    }

    /**
     * `lg` par défaut ; `md` pour les formulaires courts ; `xl` pour une
     * saisie en grille (plusieurs lignes à plusieurs colonnes), qui s'élargit
     * jusqu'à `max-w-5xl` sur grand écran.
     */
    size?: "md" | "lg" | "xl"
    /**
     * Résumé collé au-dessus des boutons du pied (totaux en direct, alertes
     * non bloquantes) : il reste visible quel que soit le défilement.
     */
    footerSummary?: ReactNode
    children: ReactNode
}

/**
 * Coquille des sheets d'entité : en-tête à pastille d'icône, corps défilant,
 * pied d'action.
 *
 * Chaque sheet du dépôt réécrivait ce chrome — mêmes paddings, mêmes bordures,
 * à quelques pixels près et avec des couleurs de palette codées en dur d'un
 * côté (`border-slate-100 dark:border-slate-800`) et des tokens de l'autre.
 * Six sheets s'appuient désormais dessus, à travers les deux modules de stock.
 *
 * Ce composant factorise la COQUILLE, pas les champs. Les formulaires de
 * création et d'édition d'une même entité demandent légitimement des choses
 * différentes — on ne saisit pas un statut de déchargement à la création d'un
 * arrivage — et les fondre en un seul jeu de champs aurait produit un
 * formulaire à conditions plutôt qu'une simplification.
 *
 * `onSubmit` apporte au passage la validation par la touche Entrée aux sheets
 * qui ne l'avaient pas : elles montaient leurs champs hors d'un `<form>`.
 */
export function FormSheet({
    open,
    onClose,
    icon: Icon,
    title,
    description,
    onSubmit,
    submitLabel = "Enregistrer",
    submitDisabled = false,
    loading = false,
    cancelLabel = "Annuler",
    onDelete,
    deleteLabel = "Supprimer",
    deleteConfirm,
    size = "lg",
    footerSummary,
    children,
}: FormSheetProps) {
    // `isValidElement` et non `typeof === "function"` : une icône Lucide est un
    // objet `forwardRef`, pas une fonction — le test naïf les envoyait toutes
    // au rendu comme enfant React, ce qui casse la sheet.
    const iconNode = isValidElement(Icon)
        ? Icon
        : createElement(Icon as LucideIcon, { size: 18, className: "text-primary" })

    const [confirmOpen, setConfirmOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const confirmDelete = async () => {
        if (!onDelete) return
        setDeleting(true)
        try {
            await onDelete()
            setConfirmOpen(false)
        } finally {
            setDeleting(false)
        }
    }

    const gutter = size === "xl" ? "px-4 sm:px-6" : "px-6"

    const body = (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={cn("flex flex-1 flex-col gap-5 overflow-y-auto py-5", gutter)}>{children}</div>

            {onSubmit && footerSummary && (
                <div className={cn("border-t border-border bg-muted/30 py-2.5", gutter)}>{footerSummary}</div>
            )}

            {onSubmit && (
                <SheetFooter className={cn("flex flex-col gap-3 border-t border-border py-4 sm:flex-row", gutter)}>
                    {onDelete && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setConfirmOpen(true)}
                            disabled={loading}
                            aria-label={deleteLabel}
                            className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            <Trash2 size={16} />
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                        className="h-10 w-full sm:flex-1"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitDisabled}
                        loading={loading}
                        className="h-10 w-full sm:flex-1"
                    >
                        {submitLabel}
                    </Button>
                </SheetFooter>
            )}
        </div>
    )

    return (
        <Sheet open={open} onOpenChange={(value) => { if (!value) onClose() }}>
            <SheetContent
                side="right"
                className={cn(
                    "flex w-full flex-col gap-0 p-0",
                    size === "xl" ? "sm:max-w-3xl lg:max-w-5xl" : size === "lg" ? "sm:max-w-lg" : "sm:max-w-md",
                )}
            >
                <SheetHeader className={cn("border-b border-border pb-4 pt-6 text-left", gutter)}>
                    <SheetTitle className="flex items-center gap-2.5 text-base font-semibold">
                        <div className="rounded-md bg-primary/10 p-1.5">{iconNode}</div>
                        {title}
                    </SheetTitle>
                    {description && (
                        <SheetDescription className="text-xs text-muted-foreground">
                            {description}
                        </SheetDescription>
                    )}
                </SheetHeader>

                {onSubmit ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            if (!submitDisabled && !loading) onSubmit()
                        }}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        {body}
                    </form>
                ) : (
                    body
                )}
            </SheetContent>

            {onDelete && (
                <AlertDialog
                    open={confirmOpen}
                    onOpenChange={(next) => {
                        // Pas de fermeture pendant l'appel : un second clic
                        // relancerait une suppression déjà partie.
                        if (!next && !deleting) setConfirmOpen(false)
                    }}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {deleteConfirm?.title ?? `${deleteLabel} ?`}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {deleteConfirm?.description ?? "Cette action est définitive."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                                // `preventDefault` : sans lui, Radix referme le
                                // dialogue avant que la suppression ne rende la
                                // main, et l'indicateur d'attente ne s'affiche pas.
                                onClick={(event) => {
                                    event.preventDefault()
                                    confirmDelete()
                                }}
                                disabled={deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {deleting ? "Suppression…" : deleteConfirm?.confirmLabel ?? "Supprimer"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </Sheet>
    )
}
