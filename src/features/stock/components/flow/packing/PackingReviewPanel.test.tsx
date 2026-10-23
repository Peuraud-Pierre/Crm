import { expect, rstest, test } from "@rstest/core"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
    PackingListLigne,
    PackingListSummary,
    PackingModelStats,
} from "@/features/stock/types/packing-list.types"
import { groupLignes, normalizePackingLabel, reviewProgress } from "@/features/stock/utils/packingGrouping"
import { PackingReviewPanel } from "./PackingReviewPanel"
import { PackingReviewToolbar } from "./PackingReviewToolbar"

/**
 * Vérification d'une packing list — ce qui la rend rapide, et ce qui la rend
 * sûre.
 *
 * Rapide : réattribuer un libellé corrige toutes ses lignes, le clavier
 * enchaîne les groupes, et les libellés déjà validés sur un précédent
 * conteneur arrivent classés, repliés hors du chemin.
 *
 * Sûre : une simple PROPOSITION ne débloque jamais la validation. Seule une
 * correspondance exacte du tableau retient une catégorie ; tout le reste
 * attend un geste humain.
 */

const CATEGORIES = [
    { value: "pull", label: "Pull Ralph Lauren" },
    { value: "polo", label: "Polo Ralph Lauren" },
    { value: "jean", label: "Jean Levi's 501" },
]
const categoryName = (id: string | null) =>
    CATEGORIES.find((c) => c.value === id)?.label ?? "Sans catégorie"

let seq = 0

/** Ligne à classer : proposition affichée, mais aucune catégorie retenue. */
function ligne(over: Partial<PackingListLigne> = {}): PackingListLigne {
    seq += 1
    const raw = over.raw_label ?? "PLO RalLrt"
    return {
        id: `l-${seq}`,
        packing_list_id: "p1",
        position: seq,
        source_row: seq + 3,
        raw_label: raw,
        raw_label_key: normalizePackingLabel(raw),
        raw_row: null,
        package_count: 10,
        units_per_package: 200,
        unit_kind: "pcs",
        declared_total: 2000,
        suggested_category_id: "pull",
        match_confidence: 0.5,
        suggestion_source: "model",
        category_id: null,
        resolution: null,
        normalizer_version: 2,
        reviewed_at: null,
        reviewed_by: null,
        ...over,
    }
}

/** Ligne tranchée par un humain. */
const settled = (over: Partial<PackingListLigne> = {}): PackingListLigne =>
    ligne({ category_id: "pull", resolution: "human", reviewed_at: "2026-09-17T00:00:00Z", ...over })

/** Ligne reconnue par le tableau de correspondance. */
const recognized = (over: Partial<PackingListLigne> = {}): PackingListLigne =>
    ligne({ category_id: "pull", resolution: "dictionary", ...over })

function renderPanel(
    lignes: PackingListLigne[],
    filter: "to_review" | "all" | "reviewed" = "to_review",
    labelQuery = "",
) {
    const handlers = {
        onAssignGroup: rstest.fn(),
        onAcceptGroup: rstest.fn(),
        onAcceptMany: rstest.fn(),
        onAssignLigne: rstest.fn(),
    }
    render(
        <PackingReviewPanel
            groups={groupLignes(lignes)}
            filter={filter}
            labelQuery={labelQuery}
            categoryOptions={CATEGORIES}
            categoryName={categoryName}
            {...handlers}
        />,
    )
    return handlers
}

const card = (rawLabel: string) => screen.getByLabelText(new RegExp(`^Libellé ${rawLabel} —`))

// ─── Regroupement ─────────────────────────────────────────────────────────────

test("un libellé répété n'occupe qu'une carte, avec ses totaux en colis", () => {
    renderPanel([
        ligne({ package_count: 40 }),
        ligne({ package_count: 16 }),
        settled({ raw_label: "LEVIS 501", category_id: "jean", suggested_category_id: "jean" }),
    ])

    expect(screen.getAllByLabelText(/^Libellé PLO RalLrt —/)).toHaveLength(1)
    expect(screen.getByText(/2 lignes/)).toHaveTextContent(/56\s?colis/)
})

test("le libellé brut et la proposition sont affichés côte à côte", () => {
    renderPanel([ligne()])

    expect(screen.getByText("« PLO RalLrt »")).toBeInTheDocument()
    expect(screen.getByText("Pull Ralph Lauren", { selector: "span.text-foreground" })).toBeInTheDocument()
    expect(screen.getByText("50 %")).toBeInTheDocument()
})

// ─── Gestes ───────────────────────────────────────────────────────────────────

test("confirmer un groupe retient la proposition pour toutes ses lignes vides", async () => {
    const { onAcceptGroup } = renderPanel([ligne(), ligne()])

    await userEvent.setup().click(screen.getByRole("button", { name: /Confirmer la catégorie de « PLO RalLrt »/ }))

    expect(onAcceptGroup).toHaveBeenCalledWith("plo rallrt", "pull")
})

test("réattribuer un groupe passe la clé normalisée du libellé et la nouvelle catégorie", async () => {
    const user = userEvent.setup()
    // Deux orthographes du même libellé : un seul appel doit corriger les deux.
    const { onAssignGroup } = renderPanel([ligne(), ligne({ raw_label: "plo rallrt" })])

    await user.click(screen.getByRole("button", { name: /Choisir la catégorie/ }))
    await user.click(await screen.findByRole("button", { name: "Polo Ralph Lauren" }))

    expect(onAssignGroup).toHaveBeenCalledTimes(1)
    expect(onAssignGroup).toHaveBeenCalledWith("plo rallrt", "polo")
})

test("un groupe acquis se replie : sa catégorie se lit, sa liste ne s'ouvre pas", () => {
    renderPanel([settled()], "all")

    expect(screen.getByText("Pull Ralph Lauren")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Choisir la catégorie/ })).not.toBeInTheDocument()
})

test("un groupe sans correspondance ne se confirme pas : il faut choisir", () => {
    renderPanel([ligne({ raw_label: "MIX JKT", suggested_category_id: null, match_confidence: null })])

    expect(screen.getByText("Aucune correspondance trouvée")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Confirmer la catégorie/ })).not.toBeInTheDocument()
})

test("Entrée sur une carte confirme le groupe et passe le focus au suivant", async () => {
    const user = userEvent.setup()
    const { onAcceptGroup } = renderPanel([
        ligne({ raw_label: "FIRST", package_count: 50 }),
        ligne({ raw_label: "SECOND", package_count: 10 }),
    ])

    act(() => card("FIRST").focus())
    await user.keyboard("{Enter}")

    expect(onAcceptGroup).toHaveBeenCalledWith("first", "pull")
    await waitFor(() => expect(card("SECOND")).toHaveFocus())
})

test("les flèches naviguent entre les cartes sans rien confirmer", async () => {
    const user = userEvent.setup()
    const { onAcceptGroup } = renderPanel([
        ligne({ raw_label: "FIRST", package_count: 50 }),
        ligne({ raw_label: "SECOND", package_count: 10 }),
    ])

    act(() => card("FIRST").focus())
    await user.keyboard("{ArrowDown}")
    await waitFor(() => expect(card("SECOND")).toHaveFocus())
    await user.keyboard("{ArrowUp}")
    await waitFor(() => expect(card("FIRST")).toHaveFocus())

    expect(onAcceptGroup).not.toHaveBeenCalled()
})

test("Entrée sur un libellé sans proposition ouvre la liste des catégories", async () => {
    // Le cas du démarrage à froid : dictionnaire vide, modèle sans seuil
    // calibré, donc aucune proposition sur la plupart des libellés. Entrée n'y
    // faisait rien du tout, et il fallait la souris pour le seul geste qui
    // restait à faire.
    const user = userEvent.setup()
    const { onAcceptGroup, onAssignGroup } = renderPanel([
        ligne({ raw_label: "MIX JKT", suggested_category_id: null, match_confidence: null }),
    ])

    act(() => card("MIX JKT").focus())
    await user.keyboard("{Enter}")

    expect(await screen.findByPlaceholderText("Rechercher...")).toBeInTheDocument()
    // Ouvrir n'est pas décider : rien n'est écrit tant qu'une catégorie n'a pas
    // été choisie.
    expect(onAcceptGroup).not.toHaveBeenCalled()
    expect(onAssignGroup).not.toHaveBeenCalled()
})

test("Espace ouvre la liste même quand une proposition existe", async () => {
    // Entrée retiendrait la proposition ; Espace couvre le cas où elle est
    // fausse et où il faut en choisir une autre, toujours sans souris.
    const user = userEvent.setup()
    const { onAcceptGroup } = renderPanel([ligne({ raw_label: "PLO RalLrt" })])

    act(() => card("PLO RalLrt").focus())
    await user.keyboard(" ")

    expect(await screen.findByPlaceholderText("Rechercher...")).toBeInTheDocument()
    expect(onAcceptGroup).not.toHaveBeenCalled()
})

test("au clavier, choisir une catégorie dans la liste ouverte réattribue le libellé", async () => {
    const user = userEvent.setup()
    const { onAssignGroup } = renderPanel([
        ligne({ raw_label: "MIX JKT", suggested_category_id: null, match_confidence: null }),
    ])

    act(() => card("MIX JKT").focus())
    await user.keyboard(" ")
    const search = await screen.findByPlaceholderText("Rechercher...")
    act(() => search.focus())
    await user.keyboard("jean{ArrowDown}{Enter}")

    expect(onAssignGroup).toHaveBeenCalledWith("mix jacket", "jean")
})

test("sans droit de modification, aucune liste ni bouton de confirmation", () => {
    render(
        <PackingReviewPanel
            groups={groupLignes([ligne()])}
            filter="all"
            categoryOptions={CATEGORIES}
            categoryName={categoryName}
        />,
    )

    expect(screen.queryByRole("button", { name: /Confirmer/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Pull Ralph Lauren" })).not.toBeInTheDocument()
})

// ─── Sélection multiple ───────────────────────────────────────────────────────

const checkbox = (rawLabel: string) =>
    screen.getByRole("checkbox", { name: new RegExp(`Sélectionner .*${rawLabel}`) })

test("cocher plusieurs libellés et choisir une catégorie n'écrit qu'une fois", async () => {
    // Mesuré sur GR154 : 121 libellés sur 121 partagent un jeton avec un autre,
    // et « jacket » en rassemble 39. C'est ce que ce geste absorbe.
    const user = userEvent.setup()
    const { onAcceptMany } = renderPanel([
        ligne({ raw_label: "MEN JKT", package_count: 50 }),
        ligne({ raw_label: "LADIES JACKET", package_count: 20 }),
        ligne({ raw_label: "POLO", package_count: 10 }),
    ])

    await user.click(checkbox("MEN JKT"))
    await user.click(checkbox("LADIES JACKET"))

    expect(screen.getByText(/2 libellés sélectionnés/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Attribuer aux lignes non classées/ }))
    await user.click(await screen.findByRole("button", { name: "Jean Levi's 501" }))

    expect(onAcceptMany).toHaveBeenCalledTimes(1)
    expect(onAcceptMany).toHaveBeenCalledWith([
        { rawLabelKey: "men jacket", categoryId: "jean" },
        { rawLabelKey: "ladie jacket", categoryId: "jean" },
    ])
})

test("Maj-clic sélectionne toute la plage affichée", async () => {
    const user = userEvent.setup()
    renderPanel([
        ligne({ raw_label: "A", package_count: 50 }),
        ligne({ raw_label: "B", package_count: 30 }),
        ligne({ raw_label: "C", package_count: 10 }),
    ])

    await user.click(checkbox("A"))
    // userEvent ne prend pas de modificateur en option de `click` : il faut
    // maintenir la touche autour du clic.
    await user.keyboard("{Shift>}")
    await user.click(checkbox("C"))
    await user.keyboard("{/Shift}")

    expect(screen.getByText(/3 libellés sélectionnés/)).toBeInTheDocument()
})

test("un libellé acquis ne se coche pas : il se corrige délibérément", () => {
    renderPanel([ligne({ raw_label: "TODO" }), settled({ raw_label: "DONE" })], "all")

    expect(checkbox("TODO")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: /Sélectionner .*DONE/ })).not.toBeInTheDocument()
})

test("sans sélection, aucune barre d'attribution", () => {
    renderPanel([ligne({ raw_label: "TODO" })])

    expect(screen.queryByText(/libellé.? sélectionné/)).not.toBeInTheDocument()
})

test("en lecture seule, aucune case à cocher", () => {
    render(
        <PackingReviewPanel
            groups={groupLignes([ligne({ raw_label: "TODO" })])}
            filter="to_review"
            categoryOptions={CATEGORIES}
            categoryName={categoryName}
        />,
    )

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
})

// ─── Recherche et reprise ─────────────────────────────────────────────────────

test("une recherche filtre les libellés affichés", async () => {
    renderPanel([ligne({ raw_label: "MEN JKT NYLON" }), ligne({ raw_label: "POLO SHIRT" })], "to_review", "jacket")

    expect(screen.getByText("« MEN JKT NYLON »")).toBeInTheDocument()
    expect(screen.queryByText("« POLO SHIRT »")).not.toBeInTheDocument()
})

test("une recherche sans résultat ne prétend PAS que tout est classé", async () => {
    // Le mensonge à éviter : des libellés restent à classer hors de la
    // recherche, et l'écran annoncerait la fin du travail.
    renderPanel([ligne({ raw_label: "MEN JKT NYLON" })], "to_review", "zzz")

    expect(screen.queryByText("Tout est classé")).not.toBeInTheDocument()
    expect(screen.getByText(/Aucun libellé ne correspond/)).toBeInTheDocument()
})

test("« Reprendre le classement » donne le focus au premier libellé, puis s'efface", async () => {
    // Le focus n'est jamais pris au montage — il volerait celui du piège de
    // focus de la sheet — d'où un bouton plutôt qu'un autofocus.
    const user = userEvent.setup()
    renderPanel([ligne({ raw_label: "FIRST", package_count: 50 }), ligne({ raw_label: "SECOND" })])

    await user.click(screen.getByRole("button", { name: "Reprendre le classement" }))

    await waitFor(() => expect(card("FIRST")).toHaveFocus())
    expect(screen.queryByRole("button", { name: "Reprendre le classement" })).not.toBeInTheDocument()
})

// ─── Catégories récentes ──────────────────────────────────────────────────────

test("le chiffre 1 attribue la dernière catégorie retenue et passe au suivant", async () => {
    // Le geste qu'on supprime n'est pas « choisir parmi 300 catégories », c'est
    // « redire pour la huitième fois celle qu'on vient de dire ».
    const user = userEvent.setup()
    const { onAssignGroup } = renderPanel([
        settled({ raw_label: "DONE", category_id: "jean" }),
        ligne({ raw_label: "TODO", package_count: 50 }),
        ligne({ raw_label: "NEXT", package_count: 10 }),
    ])

    act(() => card("TODO").focus())
    await user.keyboard("1")

    expect(onAssignGroup).toHaveBeenCalledWith("todo", "jean")
    await waitFor(() => expect(card("NEXT")).toHaveFocus())
})

test("les pastilles de raccourci ne s'affichent que sur la carte focalisée", async () => {
    const user = userEvent.setup()
    renderPanel([
        settled({ raw_label: "DONE", category_id: "jean" }),
        ligne({ raw_label: "TODO", package_count: 50 }),
        ligne({ raw_label: "NEXT", package_count: 10 }),
    ])

    expect(screen.queryByText("Récentes")).not.toBeInTheDocument()

    act(() => card("TODO").focus())
    await user.keyboard("{ArrowDown}")

    // Une seule rangée, sur la seule carte qui a le focus : les chiffres
    // n'existent que là où les pastilles se lisent.
    expect(screen.getAllByText("Récentes")).toHaveLength(1)
})

test("un chiffre sans catégorie récente correspondante ne fait rien", async () => {
    const user = userEvent.setup()
    const { onAssignGroup } = renderPanel([
        settled({ raw_label: "DONE", category_id: "jean" }),
        ligne({ raw_label: "TODO" }),
    ])

    act(() => card("TODO").focus())
    await user.keyboard("3")

    expect(onAssignGroup).not.toHaveBeenCalled()
})

test("un chiffre tapé dans la recherche d'une liste n'attribue rien", async () => {
    // Garde essentielle : sans elle, chercher « 501 » classerait le libellé.
    const user = userEvent.setup()
    const { onAssignGroup } = renderPanel([
        settled({ raw_label: "DONE", category_id: "jean" }),
        ligne({ raw_label: "TODO" }),
    ])

    act(() => card("TODO").focus())
    await user.keyboard(" ")
    const search = await screen.findByPlaceholderText("Rechercher...")
    act(() => search.focus())
    await user.keyboard("1")

    expect(onAssignGroup).not.toHaveBeenCalled()
    expect(search).toHaveValue("1")
})

// ─── Annulation ───────────────────────────────────────────────────────────────

function renderWithUndo(lignes: PackingListLigne[], undoLabels: string[]) {
    const onUndo = rstest.fn()
    render(
        <PackingReviewPanel
            groups={groupLignes(lignes)}
            filter="to_review"
            categoryOptions={CATEGORIES}
            categoryName={categoryName}
            onAssignGroup={rstest.fn()}
            onUndo={onUndo}
            undoLabels={undoLabels}
        />,
    )
    return onUndo
}

test("le bouton d'annulation nomme le libellé qu'il ramènerait", () => {
    // « Annuler » seul obligerait à se souvenir de ce qu'on annule.
    renderWithUndo([ligne({ raw_label: "X" })], ["MIX JKT"])

    expect(screen.getByRole("button", { name: /Annuler .*MIX JKT/ })).toBeInTheDocument()
})

test("l'annulation survit au dernier libellé classé", () => {
    // C'est précisément à ce moment-là qu'on veut pouvoir revenir en arrière :
    // faire disparaître le geste avec la dernière carte le retirerait quand il
    // sert le plus.
    renderWithUndo([settled()], ["MIX JKT"])

    expect(screen.getByText("Tout est classé")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Annuler .*MIX JKT/ })).toBeInTheDocument()
})

test("Ctrl+Z annule depuis une carte", async () => {
    const user = userEvent.setup()
    const onUndo = renderWithUndo([ligne({ raw_label: "X" })], ["MIX JKT"])

    act(() => card("X").focus())
    await user.keyboard("{Control>}z{/Control}")

    expect(onUndo).toHaveBeenCalledTimes(1)
})

test("Ctrl+Z dans la recherche d'une liste reste l'annulation de saisie native", async () => {
    // L'intercepter effacerait ce que quelqu'un est en train de taper.
    const user = userEvent.setup()
    const onUndo = renderWithUndo([ligne({ raw_label: "X" })], ["MIX JKT"])

    act(() => card("X").focus())
    await user.keyboard(" ")
    const search = await screen.findByPlaceholderText("Rechercher...")
    act(() => search.focus())
    await user.keyboard("{Control>}z{/Control}")

    expect(onUndo).not.toHaveBeenCalled()
})

// ─── Le travail épargné ───────────────────────────────────────────────────────

test("les libellés reconnus sont annoncés et repliés, hors du chemin", () => {
    renderPanel([
        recognized({ raw_label: "DEJA VU" }),
        recognized({ raw_label: "DEJA VU 2" }),
        ligne({ raw_label: "NOUVEAU" }),
    ])

    // Annoncés en un bandeau…
    expect(screen.getByText(/2 libellés reconnus/)).toBeInTheDocument()
    // …mais leurs cartes ne sont pas dépliées : seul le nouveau libellé l'est.
    expect(screen.queryByLabelText(/^Libellé DEJA VU —/)).not.toBeInTheDocument()
    expect(card("NOUVEAU")).toBeInTheDocument()
})

test("le bandeau des reconnus se déplie sur demande", async () => {
    renderPanel([recognized({ raw_label: "DEJA VU" }), ligne({ raw_label: "NOUVEAU" })])

    await userEvent.setup().click(screen.getByRole("button", { name: /libellé reconnu/ }))

    expect(card("DEJA VU")).toBeInTheDocument()
})

test("« Tout confirmer » n'apparaît qu'à partir de deux propositions, et les passe toutes", async () => {
    const { onAcceptMany } = renderPanel([
        ligne({ raw_label: "UN", package_count: 30 }),
        ligne({ raw_label: "DEUX", package_count: 20 }),
        ligne({ raw_label: "SANS PROPOSITION", suggested_category_id: null }),
    ])

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Confirmer les 2 propositions/ }))
    // Un geste assumé : la boîte dit combien et pourquoi s'en méfier.
    await user.click(await screen.findByRole("button", { name: "Confirmer tout" }))

    expect(onAcceptMany).toHaveBeenCalledWith([
        { rawLabelKey: "un", categoryId: "pull" },
        { rawLabelKey: "deux", categoryId: "pull" },
    ])
})

test("une seule proposition ne justifie pas un geste de masse", () => {
    renderPanel([ligne({ raw_label: "SEUL" })])

    expect(screen.queryByRole("button", { name: /Confirmer les/ })).not.toBeInTheDocument()
})

// ─── Filtre ───────────────────────────────────────────────────────────────────

test("« À classer » masque les groupes acquis et annonce la fin du travail", () => {
    renderPanel([settled()], "to_review")

    expect(screen.getByText("Tout est classé")).toBeInTheDocument()
})

// ─── Barre de validation ──────────────────────────────────────────────────────

const SUMMARY = {
    id: "p1",
    status: "a_verifier",
    container_label: "CONTENEUR GR 153",
    line_count: 2,
    declared_package_count: 20,
    total_packages: 20,
    total_pieces: 4000,
    total_weight_kg: 0,
    rows_failing_math: 0,
    package_count_gap: 0,
} as PackingListSummary

const MODEL_STATS = {
    examples: 120,
    categories: 12,
    vocabulary: 300,
    dictionary_entries: 47,
    evidence: 12,
    evidence_correct: 11,
    overall_precision: 0.9,
    threshold: null,
    precision_at_threshold: null,
    support_at_threshold: 0,
    target_precision: 0.98,
    min_evidence: 50,
} as PackingModelStats

function renderToolbar(
    lignes: PackingListLigne[],
    summary: PackingListSummary = SUMMARY,
    modelStats: PackingModelStats | null = null,
) {
    const onValidate = rstest.fn()
    render(
        <PackingReviewToolbar
            summary={summary}
            progress={reviewProgress(groupLignes(lignes))}
            gap={null}
            modelStats={modelStats}
            containerMatches
            filter="to_review"
            onFilterChange={rstest.fn()}
            labelQuery=""
            onLabelQueryChange={rstest.fn()}
            sort="risque"
            onSortChange={rstest.fn()}
            onValidate={onValidate}
            validating={false}
        />,
    )
    return onValidate
}

test("la validation reste fermée tant qu'une ligne n'a pas de catégorie", () => {
    renderToolbar([settled(), ligne({ raw_label: "X" })])

    expect(screen.getByRole("button", { name: /Valider la packing list/ })).toBeDisabled()
})

test("une proposition non retenue ne débloque PAS la validation", () => {
    // Le verrou de rigueur. L'import ne remplit `category_id` que sur
    // correspondance exacte du tableau : une suggestion, même à confiance
    // élevée, laisse la ligne à classer.
    renderToolbar([ligne(), ligne({ raw_label: "Y" })])

    expect(screen.getByRole("button", { name: /Valider la packing list/ })).toBeDisabled()
})

test("toutes les lignes classées : la validation s'ouvre", async () => {
    const onValidate = renderToolbar([settled(), settled({ raw_label: "Y" })])

    const button = screen.getByRole("button", { name: /Valider la packing list/ })
    expect(button).toBeEnabled()
    await userEvent.setup().click(button)
    expect(onValidate).toHaveBeenCalledTimes(1)
})

test("un libellé reconnu par le tableau compte comme classé et n'empêche rien", () => {
    const onValidate = renderToolbar([recognized(), recognized({ raw_label: "Y" })])

    expect(screen.getByRole("button", { name: /Valider la packing list/ })).toBeEnabled()
    expect(screen.getByText(/dont 2 reconnus automatiquement/)).toBeInTheDocument()
    expect(onValidate).not.toHaveBeenCalled()
})

test("la progression compte les libellés acquis, quelle que soit leur provenance", () => {
    renderToolbar([settled(), ligne({ raw_label: "Y" })])

    expect(screen.getByText("1 / 2")).toBeInTheDocument()
})

test("au premier conteneur d'un vocabulaire, l'écran dit pourquoi rien n'est reconnu", () => {
    // 140 cartes nues se lisent comme une corvée arbitraire tant qu'on ignore
    // qu'elles ne reviendront pas au conteneur suivant.
    renderToolbar([ligne(), ligne({ raw_label: "Y" })])

    expect(screen.getByText(/premier conteneur de ce vocabulaire/)).toBeInTheDocument()
})

test("dès qu'un libellé est reconnu, l'amorce du premier conteneur disparaît", () => {
    renderToolbar([recognized(), ligne({ raw_label: "Y" })])

    expect(screen.queryByText(/premier conteneur de ce vocabulaire/)).not.toBeInTheDocument()
})

test("ce qu'il manque au classement automatique se lit là où l'on classe", () => {
    renderToolbar([ligne()], SUMMARY, MODEL_STATS)

    expect(screen.getByText(/n'est pas encore actif/)).toHaveTextContent(
        /98 % du temps sur 50 propositions vérifiées \(12 à ce jour\)/,
    )
})

test("sans service d'apprentissage, aucune ligne d'état du modèle", () => {
    // Au milieu du travail, une indisponibilité que l'utilisateur ne peut pas
    // réparer et qui ne le bloque pas n'a rien à dire.
    renderToolbar([ligne()], SUMMARY, null)

    expect(screen.queryByText(/classement automatique/i)).not.toBeInTheDocument()
})

// ─── Intégrité du fichier ─────────────────────────────────────────────────────

test("un fichier qui se recoupe est annoncé comme tel", () => {
    renderToolbar([settled()])

    expect(screen.getByText(/Le fichier se recoupe/)).toBeInTheDocument()
})

test("un fichier qui ne se recoupe pas affiche l'écart de colis", () => {
    // Le cas réel de CONTENEUR GR153 : 543 colis lus, 548 annoncés.
    renderToolbar([settled()], {
        ...SUMMARY,
        total_packages: 543,
        declared_package_count: 548,
        package_count_gap: -5,
    } as PackingListSummary)

    expect(screen.getByText(/annoncés par le fichier/)).toBeInTheDocument()
    expect(screen.getByText("548")).toBeInTheDocument()
})

test("des lignes dont le calcul ne tombe pas juste sont signalées", () => {
    renderToolbar([settled()], { ...SUMMARY, rows_failing_math: 3 } as PackingListSummary)

    expect(screen.getByText(/3 lignes dont le calcul ne tombe pas juste/)).toBeInTheDocument()
})

test("un fichier attaché au mauvais arrivage est signalé avant validation", () => {
    const onValidate = rstest.fn()
    render(
        <PackingReviewToolbar
            summary={SUMMARY}
            progress={reviewProgress(groupLignes([settled()]))}
            gap={null}
            modelStats={null}
            containerMatches={false}
            filter="to_review"
            onFilterChange={rstest.fn()}
            labelQuery=""
            onLabelQueryChange={rstest.fn()}
            sort="risque"
            onSortChange={rstest.fn()}
            onValidate={onValidate}
            validating={false}
        />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(/ne correspond pas au conteneur de cet arrivage/)
})

test("un poids absent se lit « non renseigné », jamais « 0 kg »", () => {
    // Sur un document en pièces, `total_weight_kg` vaut 0 : ce zéro veut dire
    // que le fournisseur ne donne pas de poids, pas que le conteneur est vide.
    renderToolbar([settled()])

    expect(screen.getByText("non renseigné")).toBeInTheDocument()
})

// ─── Classement automatique ───────────────────────────────────────────────────

/** Ligne classée seule par le modèle de packing-api. */
const learned = (over: Partial<PackingListLigne> = {}): PackingListLigne =>
    ligne({ category_id: "pull", resolution: "model", match_confidence: 0.93, ...over })

test("un groupe classé par le modèle reste déplié, avec sa confiance, et se corrige d'un geste", async () => {
    const user = userEvent.setup()
    const { onAssignGroup } = renderPanel([learned()])

    expect(screen.getByText(/Classés automatiquement \(1\)/)).toBeInTheDocument()
    expect(screen.getByText("Classé par le modèle")).toBeInTheDocument()
    expect(screen.getByText("93 %")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Pull Ralph Lauren/ }))
    await user.click(await screen.findByRole("button", { name: "Polo Ralph Lauren" }))

    expect(onAssignGroup).toHaveBeenCalledWith("plo rallrt", "polo")
})

test("un groupe classé par le modèle ne bloque pas la validation", () => {
    const progress = reviewProgress(groupLignes([learned(), recognized({ raw_label: "DEJA VU" })]))

    expect(progress.modelGroups).toBe(1)
    expect(progress.unmatchedLines).toBe(0)
    expect(progress.canValidate).toBe(true)
})

test("Entrée ne « confirme » pas un groupe classé par le modèle : il n'y a rien à retenir", async () => {
    const user = userEvent.setup()
    const { onAcceptGroup, onAssignGroup } = renderPanel([learned()])

    act(() => card("PLO RalLrt").focus())
    await user.keyboard("{Enter}")

    expect(onAcceptGroup).not.toHaveBeenCalled()
    expect(onAssignGroup).not.toHaveBeenCalled()
    // Et elle n'ouvre pas non plus la liste : un groupe acquis ne change pas sur
    // une frappe, il se corrige délibérément à la souris ou au clic.
    expect(screen.queryByPlaceholderText("Rechercher...")).not.toBeInTheDocument()
})

// ─── Catégorie manquante ──────────────────────────────────────────────────────

function renderWithCreation(lignes: PackingListLigne[]) {
    const onCreateCategory = rstest.fn()
    const onAssignGroup = rstest.fn()
    const onAssignLigne = rstest.fn()
    render(
        <PackingReviewPanel
            groups={groupLignes(lignes)}
            filter="to_review"
            categoryOptions={CATEGORIES}
            categoryName={categoryName}
            onAssignGroup={onAssignGroup}
            onAssignLigne={onAssignLigne}
            onCreateCategory={onCreateCategory}
        />,
    )
    return { onCreateCategory, onAssignGroup, onAssignLigne }
}

test("aucune catégorie ne convient : la recherche propose de la créer, puis l'attribue au libellé", async () => {
    const user = userEvent.setup()
    const { onCreateCategory, onAssignGroup } = renderWithCreation([
        ligne({ raw_label: "SHORT HAWAII", suggested_category_id: null, match_confidence: null }),
    ])

    await user.click(screen.getByRole("button", { name: /Choisir la catégorie/ }))
    await user.type(screen.getByPlaceholderText("Rechercher..."), "Short")
    expect(screen.getByText("Aucune catégorie")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Nouvelle catégorie « Short »" }))

    expect(onCreateCategory).toHaveBeenCalledTimes(1)
    const [name, assign] = onCreateCategory.mock.calls[0] as [string, (id: string) => void]
    expect(name).toBe("Short")

    // La catégorie créée est attribuée au libellé d'où la demande est partie.
    assign("cat-short")
    expect(onAssignGroup).toHaveBeenCalledWith("short hawaii", "cat-short")
})

test("Entrée dans une recherche sans résultat crée la catégorie", async () => {
    const user = userEvent.setup()
    const { onCreateCategory } = renderWithCreation([
        ligne({ raw_label: "SHORT HAWAII", suggested_category_id: null, match_confidence: null }),
    ])

    await user.click(screen.getByRole("button", { name: /Choisir la catégorie/ }))
    await user.type(screen.getByPlaceholderText("Rechercher..."), "Short Hawaii{Enter}")

    expect(onCreateCategory.mock.calls[0][0]).toBe("Short Hawaii")
})

test("pas de création sans recherche, ni pour un libellé qui existe déjà", async () => {
    const user = userEvent.setup()
    const { onCreateCategory } = renderWithCreation([
        ligne({ raw_label: "SHORT HAWAII", suggested_category_id: null, match_confidence: null }),
    ])

    await user.click(screen.getByRole("button", { name: /Choisir la catégorie/ }))
    expect(screen.queryByRole("button", { name: /Nouvelle catégorie/ })).not.toBeInTheDocument()

    // Même libellé qu'une catégorie existante, casse près : ce serait un doublon.
    await user.type(screen.getByPlaceholderText("Rechercher..."), "pull ralph lauren")
    expect(screen.queryByRole("button", { name: /Nouvelle catégorie/ })).not.toBeInTheDocument()
    expect(onCreateCategory).not.toHaveBeenCalled()

    // Espaces internes surnuméraires : toujours le même doublon. Sans la
    // réduction des espaces, celui-là passait la garde.
    await user.clear(screen.getByPlaceholderText("Rechercher..."))
    await user.type(screen.getByPlaceholderText("Rechercher..."), "pull  ralph   lauren")
    expect(screen.queryByRole("button", { name: /Nouvelle catégorie/ })).not.toBeInTheDocument()
    expect(onCreateCategory).not.toHaveBeenCalled()
})

test("sans le droit de créer une catégorie, aucun bouton de création", async () => {
    const user = userEvent.setup()
    renderPanel([ligne({ suggested_category_id: null, match_confidence: null })])

    await user.click(screen.getByRole("button", { name: /Choisir la catégorie/ }))

    await user.type(screen.getByPlaceholderText("Rechercher..."), "Short")
    expect(screen.queryByRole("button", { name: /Nouvelle catégorie/ })).not.toBeInTheDocument()
})
