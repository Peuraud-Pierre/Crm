// ── BiblioMainColumn.tsx ──────────────────────────────────────────────────────
// RÔLE : Colonne principale (droite) de la vue normale.
//
// Affiche, pour la thématique sélectionnée dans BiblioSidebar :
//   - L'image et le nom de la thématique en en-tête
//   - La liste de ses Q&R (une QRCard par question), paginée à QR_PAGE_SIZE
//     éléments par page, avec bouton "Ajouter une question"
//   - Un écran vide avec invitation à créer la première Q&R si la liste est vide
//
// Aucune prop : tout vient du contexte BiblioContext.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - routes/Bibliotheque.tsx → rendu à droite quand activeId est non vide (état 4)
//
// CE FICHIER IMPORTE :
//   - context/BiblioContext.tsx → lit activeThematique, activeQRs, openCreateQR
//   - components/QRCard.tsx     → rendu de chaque question-réponse

import { useEffect, useMemo, useState } from "react"
import { useBiblioContext } from "../context/BiblioContext"
import { tLabel } from "../utils"
import { QRCard } from "./QRCard"
import { Button } from "@/shared/ui/atoms/button"
import { Plus, MessageSquareDashed } from "lucide-react"

// Nombre de Q&R affichées par page. Sans pagination, une thématique très
// fournie forcerait le montage simultané de toutes ses QRCard (chacune avec
// son propre ResizeObserver pour la détection "Voir plus") — coûteux au-delà
// de quelques dizaines d'éléments et sans bénéfice pour l'utilisateur qui ne
// regarde qu'une poignée de questions à la fois.
const QR_PAGE_SIZE = 10

export function BiblioMainColumn() {
    // Ce composant n'a aucune prop : toutes les données qu'il affiche viennent
    // du "contexte" React (useBiblioContext), un état partagé accessible sans
    // avoir à le faire transiter par des props depuis un composant parent.
    const {
        data: { activeThematique, activeQRs },
        perms: { canManage },
        nav: { lang, ui },
        dialogs: { openCreateQR, openEditQR, openDeleteQR, openViewFormat },
        handlers: { resolveThematiqueMediaUrl },
    } = useBiblioContext()

    // useMemo(calcul, dépendances) : ne relance "calcul" que si une des
    // dépendances a changé depuis le dernier rendu, sinon réutilise le résultat
    // précédent. Ici : résolue seulement quand l'image de la thématique active
    // change, pas à chaque render de cette colonne (ex: ajout d'une Q&R,
    // changement de langue).
    const resolvedImageUrl = useMemo(
        () => resolveThematiqueMediaUrl(activeThematique?.imageUrl),
        [activeThematique?.imageUrl, resolveThematiqueMediaUrl]
    )

    // useState(0) crée une variable réactive "page" (page courante, 0-indexée)
    // et sa fonction de mise à jour "setPage" : appeler setPage déclenche un
    // nouveau rendu du composant avec la nouvelle valeur.
    const [page, setPage] = useState(0)
    // useEffect(fonction, dépendances) exécute "fonction" après le rendu, à
    // chaque fois qu'une dépendance change. Ici : on remet page à 0 dès que la
    // thématique active change — sans quoi, en passant d'une thématique à 30 Q&R
    // (page 3) à une thématique à 5 Q&R, la page resterait hors bornes.
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resync d'un état local (pagination) sur changement de thématique active, non dérivable des props
    useEffect(() => { setPage(0) }, [activeThematique?.id])

    const totalPages = Math.max(1, Math.ceil(activeQRs.length / QR_PAGE_SIZE))
    // Filet de sécurité dérivé (pas de useEffect) : si une suppression fait
    // rétrécir activeQRs pendant que `page` pointait au-delà de la nouvelle
    // dernière page, on affiche cette dernière page sans jamais muter `page`
    // lui-même — s'il redevient valide ensuite (nouvel ajout), on retrouve la
    // position d'origine sans logique de resynchronisation supplémentaire.
    const clampedPage = Math.min(page, totalPages - 1)
    const pagedQRs = useMemo(
        () => activeQRs.slice(clampedPage * QR_PAGE_SIZE, (clampedPage + 1) * QR_PAGE_SIZE),
        [activeQRs, clampedPage]
    )

    return (
        // Colonne entièrement scrollable : header et liste de Q&R défilent ensemble
        // (pas de header fixe séparé).
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col gap-4">
            {/* Header : image + titre, puis label de section + bouton d'ajout juste en dessous. */}
            <div className="flex items-center gap-3 shrink-0">
                {/* Rendu conditionnel avec && : si resolvedImageUrl est une chaîne
                    vide/undefined (donc "falsy"), React n'affiche rien ; sinon il
                    affiche l'élément à droite du &&. */}
                {resolvedImageUrl && (
                    <img
                        src={resolvedImageUrl}
                        alt=""
                        className="w-biblio-topic-img h-biblio-topic-img rounded-xl object-cover shrink-0"
                    />
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <h2 className="text-lg sm:text-xl font-semibold text-foreground uppercase break-words">
                        {activeThematique ? tLabel(activeThematique, lang) : ""}
                    </h2>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            {ui.qrSection}
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground normal-case tracking-normal">
                                {activeQRs.length}
                            </span>
                        </p>
                        {canManage && (
                            <Button
                                size="sm"
                                className="gap-2 shrink-0"
                                onClick={openCreateQR}
                            >
                                <Plus className="w-4 h-4 shrink-0" />{" "}
                                {ui.addQuestion}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* État vide : aucune Q&R pour cette thématique.
                Rendu conditionnel avec un ternaire (condition ? siVrai : siFaux) :
                affiche l'écran vide si la liste est vide, sinon la liste paginée. */}
            {activeQRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <MessageSquareDashed className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{ui.noQuestions}</p>
                    {canManage && (
                        <Button
                            size="sm"
                            className="gap-2"
                            onClick={openCreateQR}
                        >
                            <Plus className="w-4 h-4" /> {ui.addFirstQuestion}
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* .map() transforme chaque élément du tableau pagedQRs en un composant
                            QRCard — une QRCard par question/réponse, page courante uniquement.
                            key={qr.id} : identifiant unique exigé par React pour qu'il sache
                            reconnaître chaque élément d'une liste d'un rendu à l'autre (et
                            éviter de mélanger leur état interne). */}
                        {/* canManage/lang/ui/callbacks transmis en props (pas lus par QRCard
                            lui-même) : openEditQR/openDeleteQR/openViewFormat sont des
                            références stables (voir useDialog.ts), ce qui permet à QRCard
                            (enveloppé dans memo(), voir son en-tête) de sauter son rendu
                            tant que sa propre Q&R n'a pas changé. */}
                        {pagedQRs.map((qr) => (
                            <QRCard
                                key={qr.id}
                                qr={qr}
                                canManage={canManage}
                                lang={lang}
                                ui={ui}
                                onEdit={openEditQR}
                                onDelete={openDeleteQR}
                                onViewFormat={openViewFormat}
                            />
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3 pt-1 pb-2">
                            <Button
                                variant="outline" size="sm" className="h-7 px-2 text-xs"
                                disabled={clampedPage === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                            >
                                {ui.paginationPrevious}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                {ui.paginationPageOf(clampedPage + 1, totalPages)}
                            </span>
                            <Button
                                variant="outline" size="sm" className="h-7 px-2 text-xs"
                                disabled={clampedPage >= totalPages - 1}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                {ui.paginationNext}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
