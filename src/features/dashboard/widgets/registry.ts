import { lazy } from "react"
import { Compass, NotebookPen } from "lucide-react"
import { crmWidgets } from "@/features/crm"
import { leadWidgets } from "@/features/leads"
import { messageWidgets } from "@/features/messages"
import { notificationWidgets } from "@/features/notifications"
import { projectWidgets } from "@/features/projects"
import { stockWidgets } from "@/features/stock"
import { ticketWidgets } from "@/features/tickets"
import type { WidgetDef } from "@/shared/types/widget.types"
import { SETTINGS_TEXT_MAX } from "../constants"

/**
 * Catalogue de tous les modules posables sur le canevas.
 *
 * Ce fichier ne DÉCLARE presque rien : chaque feature définit ses widgets
 * chez elle (`src/features/<f>/widgets/`) et les expose par son barrel.
 * Le registre se contente de concaténer. Ajouter un module au dashboard
 * ne demande donc pas de toucher au dashboard.
 *
 * C'est aussi le seul point de couplage entre le dashboard et les autres
 * features, et il passe exclusivement par leurs API publiques.
 *
 * Les annonces et le changelog n'y figurent plus : ils ne sont plus des
 * modules qu'on pose, mais les deux zones fixes de la page.
 */

/**
 * Les deux modules du dashboard lui-même : ils ne montrent aucune donnée
 * métier, donc aucune feature ne les possède. Les raccourcis rendent la
 * navigation que `allowedRoutes` a déjà calculée ; le bloc-notes ne lit
 * rien du tout.
 */
const dashboardWidgets: WidgetDef[] = [
    {
        id: "dashboard.shortcuts",
        title: "Raccourcis",
        description: "Accès direct aux modules auxquels vous avez droit.",
        icon: Compass,
        category: "outils",
        accent: "chart-7",
        // Deux listes de raccourcis sur la même page ne servent à rien.
        maxInstances: 1,
        starter: 1,
        defaultW: 6,
        defaultH: 4,
        settings: [
            {
                key: "items",
                label: "Raccourcis affichés",
                description:
                    "Rien de coché affiche tous les modules auxquels vous avez droit. L'ordre des cases cochées est celui de la liste.",
                type: "multiselect",
                // Les options ne peuvent pas être écrites ici : elles
                // dépendent des permissions du compte. Le panneau de
                // réglages les résout depuis `allowedRoutes`.
                optionsSource: "routes",
                defaultValue: "",
            },
            {
                key: "display",
                label: "Présentation",
                description:
                    "La grille tient plus de raccourcis, la liste se parcourt plus vite.",
                type: "select",
                options: [
                    { value: "grid", label: "Grille" },
                    { value: "list", label: "Liste" },
                ],
                defaultValue: "grid",
            },
            {
                key: "limit",
                label: "Nombre affiché",
                description:
                    "0 n'impose aucune limite. S'applique après la sélection ci-dessus.",
                type: "number",
                min: 0,
                max: 30,
                defaultValue: 0,
            },
        ],
        Component: lazy(() => import("./ShortcutsWidget")),
    },
    {
        id: "dashboard.notes",
        title: "Bloc-notes",
        description: "Un pense-bête libre, à vous seul.",
        icon: NotebookPen,
        category: "outils",
        accent: "chart-8",
        defaultW: 4,
        defaultH: 4,
        settings: [
            {
                key: "title",
                label: "Titre",
                description:
                    "Pour distinguer plusieurs blocs-notes. Vide, la carte s'appelle « Bloc-notes ».",
                type: "text",
                // Court : ce titre vit dans l'en-tête d'une carte, où il
                // est tronqué bien avant 60 caractères.
                maxLength: 60,
                placeholder: "Bloc-notes",
                defaultValue: "",
            },
            {
                key: "text",
                label: "Contenu",
                type: "text",
                multiline: true,
                maxLength: SETTINGS_TEXT_MAX,
                placeholder: "Ce que vous ne voulez pas oublier…",
                defaultValue: "",
            },
        ],
        Component: lazy(() => import("./NotesWidget")),
    },
]

const ALL_WIDGETS: WidgetDef[] = [
    ...dashboardWidgets,
    ...crmWidgets,
    ...leadWidgets,
    ...messageWidgets,
    ...notificationWidgets,
    ...projectWidgets,
    ...stockWidgets,
    ...ticketWidgets,
]

/** Index par identifiant, pour résoudre une disposition enregistrée. */
const BY_ID = new Map(ALL_WIDGETS.map((w) => [w.id, w]))

export function getWidget(id: string): WidgetDef | undefined {
    return BY_ID.get(id)
}

export function listWidgets(): WidgetDef[] {
    return ALL_WIDGETS
}

/**
 * Modules que cet utilisateur a le droit de voir.
 *
 * Filtre volontairement au même endroit pour le catalogue et pour le
 * rendu : un widget dont la permission a été retirée disparaît de la
 * page à la connexion suivante, sans qu'il faille nettoyer la
 * disposition enregistrée en base.
 */
export function listAvailableWidgets(
    hasPermission: (code: string) => boolean
): WidgetDef[] {
    return ALL_WIDGETS.filter(
        (w) => !w.permission || hasPermission(w.permission)
    )
}
