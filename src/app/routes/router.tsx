import { createBrowserRouter, Navigate } from "react-router"
import { AuthGuardLayout } from "./layouts/AuthGuardLayout"
import { PublicOnlyLayout, PublicLayout } from "./layouts/PublicLayout"
import { RootRedirect } from "./RootRedirect"
import RouteErrorFallback from "./RouteErrorFallback"
import { env } from "@/shared/lib/env"

export const router = createBrowserRouter([
    // Public-only routes (redirect to dashboard if already authenticated)
    {
        errorElement: <RouteErrorFallback />,
        element: <PublicOnlyLayout />,
        children: [
            {
                path: "/login",
                lazy: async () => {
                    const m = await import("@/features/auth/routes/Login")
                    return { Component: m.default }
                },
            },
        ],
    },

    // Public routes (always accessible)
    {
        errorElement: <RouteErrorFallback />,
        element: <PublicLayout />,
        children: [
            {
                path: "/forgot-password",
                lazy: async () => {
                    const m =
                        await import("@/features/auth/routes/ForgotPassword")
                    return { Component: m.default }
                },
            },
            {
                path: "/reset-password",
                lazy: async () => {
                    const m =
                        await import("@/features/auth/routes/ResetPassword")
                    return { Component: m.default }
                },
            },
            {
                path: "/auth/confirm",
                lazy: async () => {
                    const m = await import("@/features/auth/routes/AuthConfirm")
                    return { Component: m.default }
                },
            },
            {
                path: "/auth/outlook/callback",
                lazy: async () => {
                    const m =
                        await import("@/features/auth/routes/outlook/OutlookCallback")
                    return { Component: m.default }
                },
            },
        ],
    },

    // Protected routes (auth required)
    {
        errorElement: <RouteErrorFallback />,
        element: <AuthGuardLayout />,
        children: [
            {
                path: "/",
                element: <RootRedirect />,
            },
            {
                path: "/dashboard",
                handle: {
                    featureKey: "dashboard",
                    permissionCode: "dashboard.view",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/dashboard/routes/Dashboard")
                    return { Component: m.default }
                },
            },
            {
                // Routing CRM par chemin :
                //   /crm                       → onglet par défaut
                //   /crm/agenda/days           → calendrier, vue jour
                //   /crm/clients               → liste clients
                //   /crm/client/{id_client}    → fiche d'un client
                //   /crm/{quotes|tache|analytics}
                path: "/crm/:section?/:detail?",
                handle: {
                    featureKey: "crm",
                    permissionCode: "crm.view",
                    requireMfa: true,
                },
                lazy: async () => {
                    const { default: SinglePageCRM } =
                        await import("@/features/crm/routes/SinglePageCRM")
                    const { CRMProvider } =
                        await import("@/features/crm/context/CRMContext")
                    const { DevisProvider } =
                        await import("@/features/crm/context/DevisContext")
                    return {
                        Component: () => (
                            <CRMProvider>
                                <DevisProvider>
                                    <SinglePageCRM />
                                </DevisProvider>
                            </CRMProvider>
                        ),
                    }
                },
            },
            {
                path: "/content",
                handle: {
                    featureKey: "content",
                    permissionCode: "content.view",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/content/routes/ContentGeneration")
                    return { Component: m.default }
                },
            },
            {
                path: "/contentlist",
                handle: {
                    featureKey: "contentlist",
                    permissionCode: "content.view",
                },
                lazy: async () => {
                    const { default: ContentList } =
                        await import("@/features/content/routes/ContentList")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { useAuth } =
                        await import("@/features/auth/hooks/useAuth/AuthProvider")
                    return {
                        Component: () => {
                            const { user } = useAuth()
                            return (
                                <ProfilesProvider>
                                    <ContentList
                                        userId={user!.user_id}
                                        adminView={false}
                                    />
                                </ProfilesProvider>
                            )
                        },
                    }
                },
            },
            {
                path: "/contentlistadmin",
                handle: {
                    featureKey: "contentlistadmin",
                    permissionCode: "content.manage",
                },
                lazy: async () => {
                    const { default: ContentList } =
                        await import("@/features/content/routes/ContentList")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { useAuth } =
                        await import("@/features/auth/hooks/useAuth/AuthProvider")
                    return {
                        Component: () => {
                            const { user } = useAuth()
                            return (
                                <ProfilesProvider>
                                    <ContentList
                                        userId={user!.user_id}
                                        adminView={true}
                                    />
                                </ProfilesProvider>
                            )
                        },
                    }
                },
            },
            {
                path: "/messages",
                handle: {
                    featureKey: "messages",
                    permissionCode: "messages.view",
                },
                lazy: async () => {
                    const { ChatView } =
                        await import("@/features/messages/components/ChatView")
                    return {
                        // Pas de destinataire par défaut : la sidebar liste les
                        // conversations. (Passer user.user_id ouvrait une
                        // conversation avec soi-même.)
                        Component: () => <ChatView />,
                    }
                },
            },
            {
                // URL = source de vérité (docs/ROUTING.md) :
                // /projects/:projectId?/:view?/:taskId? + ?sprint=<id>
                path: "/projects/:projectId?/:view?/:taskId?",
                handle: {
                    featureKey: "projects",
                    permissionCode: "projects.view",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/projects/routes/Projects")
                    return { Component: m.default }
                },
            },
            {
                // Ancienne URL de la galerie : conservée en redirection, les
                // liens partagés et les favoris existants pointent dessus.
                path: "/gallery",
                element: <Navigate to="/drive" replace />,
            },
            {
                // Déclarée AVANT /drive/:folderId? : React Router donne la
                // priorité au segment statique, et un identifiant de dossier
                // est un uuid, jamais "corbeille".
                path: "/drive/corbeille",
                handle: { permissionCode: "content.view" },
                lazy: async () => {
                    const { default: Trash } =
                        await import("@/features/drive/routes/Trash")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <Trash />
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                // Dossier courant dans l'URL (docs/ROUTING.md) : deep-link,
                // retour arrière et partage de lien sans état à synchroniser.
                path: "/drive/:folderId?",
                handle: { permissionCode: "content.view" },
                lazy: async () => {
                    const { default: Drive } =
                        await import("@/features/drive/routes/Drive")
                    const { ShareProvider } =
                        await import("@/features/drive/context/ShareProvider")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <ShareProvider
                                    baseUrl={
                                        env.PUBLIC_API_BASE_URL + "/api/gallery"
                                    }
                                >
                                    <Drive />
                                </ShareProvider>
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                // Onglets deep-linkés (docs/ROUTING.md) : /analytics/:tab?
                path: "/analytics/:tab?",
                // OR : Matomo ou profil « stats restreintes » (onglet Leads seul)
                handle: {
                    featureKey: "analytics",
                    permissionCode: [
                        "matomo.view",
                        "leads_stats.view",
                        "crm.view",
                    ],
                },
                lazy: async () => {
                    const m =
                        await import("@/features/analytics/routes/Analytics")
                    return { Component: m.default }
                },
            },
            {
                path: "/ping-pong",
                handle: {
                    featureKey: "ping_pong",
                    permissionCode: "ping_pong.view",
                },
                lazy: async () => {
                    const { default: PingPong } =
                        await import("@/features/pingpong/routes/PingPong")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <PingPong />
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            // Anciennes pages fusionnées dans /administration
            {
                path: "/users",
                element: <Navigate to="/administration/utilisateurs" replace />,
            },
            {
                path: "/roles-services",
                element: <Navigate to="/administration/roles" replace />,
            },
            {
                // Page fusionnée : onglets Utilisateurs / Rôles / Services /
                // Permissions — accessible avec l'un OU l'autre des codes,
                // le gating fin par onglet est fait dans la page.
                path: "/administration/:tab?",
                handle: {
                    featureKey: "administration",
                    permissionCode: ["users.view", "roles_services.view"],
                },
                lazy: async () => {
                    const m =
                        await import("@/features/administration/routes/Administration")
                    return { Component: m.default }
                },
            },
            {
                // Onglets deep-linkés (docs/ROUTING.md) : /manager/:tab?
                path: "/manager/:tab?",
                handle: {
                    featureKey: "manager",
                    permissionCode: "manager.view",
                },
                lazy: async () => {
                    const m = await import("@/features/manager/routes/Manager")
                    return { Component: m.default }
                },
            },
            {
                path: "/tickets",
                handle: {
                    featureKey: "tickets",
                    permissionCode: "tickets.view",
                },
                lazy: async () => {
                    const { default: Tickets } =
                        await import("@/features/tickets/routes/Tickets")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { TicketProvider } =
                        await import("@/features/tickets/context/TicketContext")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <TicketProvider>
                                    <Tickets />
                                </TicketProvider>
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                path: "/reports",
                handle: {
                    featureKey: "reports",
                    permissionCode: "reports.view",
                },
                lazy: async () => {
                    const { TicketCreationPage } =
                        await import("@/features/tickets/routes/MyTicketsPage")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { TicketProvider } =
                        await import("@/features/tickets/context/TicketContext")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <TicketProvider>
                                    <TicketCreationPage />
                                </TicketProvider>
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                path: "/error-console",
                handle: {
                    featureKey: "error_console",
                    permissionCode: "manager.console",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/error-console/routes/ErrorConsolePage")
                    return { Component: m.default }
                },
            },
            {
                // Onglets + sheet de détail deep-linkés, voir docs/ROUTING.md :
                //   /stock              → redirige vers /stock/flux
                //   /stock/flux         → onglet Flux, tableau des arrivages
                //   /stock/flux/new     → sheet de création ouverte
                //   /stock/flux/{id}    → sheet d'édition du conteneur {id}
                // Les segments `arrivage` et `stock` sont les noms d'avant la
                // convergence UI des stocks : ils restent traduits par
                // LEGACY_SECTIONS (types/ui.types.ts), détail conservé.
                path: "/stock/:section?/:detail?",
                handle: {
                    featureKey: "stock",
                    permissionCode: "stock.view",
                },
                lazy: async () => {
                    const { default: Stock } =
                        await import("@/features/stock/routes/Stock")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { default: StockProvider } =
                        await import("@/features/stock/hooks/context/StockProvider")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <StockProvider>
                                    <Stock />
                                </StockProvider>
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                // Salle de tri : page à part, liée au stock principal par ses
                // référentiels et son journal.
                //   /salle-de-tri          → fiches de tri (?vue=statistiques|referentiel)
                //   /salle-de-tri/new      → saisie d'une fiche
                //   /salle-de-tri/{id}     → fiche résumé
                // `requireMfa` : toute la RLS du stock exige aal2.
                path: "/salle-de-tri/:detail?",
                handle: {
                    featureKey: "stock",
                    permissionCode: "stock.tri.view",
                    requireMfa: true,
                },
                lazy: async () => {
                    const { SalleTriRoute: SalleTri } = await import("@/features/salle-de-tri")
                    const { ReferentialProvider } = await import("@/features/stock")
                    return {
                        Component: () => (
                            <ReferentialProvider>
                                <SalleTri />
                            </ReferentialProvider>
                        ),
                    }
                },
            },
            {
                // Commandes boutiques : page à part, liée au stock principal,
                // en deux espaces (entrepôt / boutique) déduits de `?vue=`.
                //   /commandes                         → « À faire » (entrepôt), ou l'accueil boutique
                //                                        (?vue=a-faire|planning|commandes|livraisons|boutiques|accueil|reception|mes-commandes)
                //   /commandes/{id}?vue=commandes      → fiche d'une commande (entrepôt)
                //   /commandes/{id}?vue=livraisons     → fiche d'une livraison (entrepôt)
                //   /commandes/{id}?vue=reception      → réception d'une livraison (boutique)
                //   /commandes/{id}?vue=mes-commandes  → fiche d'une commande (boutique)
                // `stock.commandes.view` ouvre la page ; la boutique la détient
                // AUSSI, en plus de `stock.commandes.boutique`.
                // Ces URL sont aussi écrites par les notifications SQL
                // (20261001110000_stock_commandes.sql) : ne pas les renommer
                // sans y reporter le changement.
                path: "/commandes/:detail?",
                handle: {
                    featureKey: "stock",
                    permissionCode: "stock.commandes.view",
                    requireMfa: true,
                },
                lazy: async () => {
                    const { CommandesRoute: Commandes } = await import("@/features/commandes")
                    const { ReferentialProvider } = await import("@/features/stock")
                    return {
                        Component: () => (
                            <ReferentialProvider>
                                <Commandes />
                            </ReferentialProvider>
                        ),
                    }
                },
            },
            {
                // Second stock, isolé du stock principal (tables et permissions
                // propres). Mêmes conventions d'URL, voir docs/ROUTING.md :
                //   /stock-handpick                  → redirige vers /stock-handpick/inventaire
                //   /stock-handpick/inventaire       → onglet Inventaire
                //   /stock-handpick/codes/<id>       → résultat du scan d'une étiquette d'emplacement
                //   /stock-handpick/parametres/...   → sous-section des Paramètres
                path: "/stock-handpick/:section?/:detail?",
                handle: {
                    featureKey: "stock_handpick",
                    permissionCode: "stock_handpick.view",
                },
                lazy: async () => {
                    const { default: StockHandpick } =
                        await import("@/features/stock_handpick/routes/StockHandpick")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { default: StockHandpickProvider } =
                        await import("@/features/stock_handpick/hooks/context/StockHandpickProvider")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <StockHandpickProvider>
                                    <StockHandpick />
                                </StockHandpickProvider>
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                // Magasins et plan de leurs emplacements (docs/ROUTING.md) :
                //   /magasins                    → liste
                //   /magasins/<id>               → redirige vers /magasins/<id>/plan
                //   /magasins/<id>/emplacements  → onglet Emplacements
                // `requireMfa` : toute la RLS des magasins exige aal2.
                path: "/magasins/:magasinId?/:section?",
                handle: {
                    featureKey: "magasins",
                    permissionCode: "magasin.view",
                    requireMfa: true,
                },
                lazy: async () => {
                    const m = await import("@/features/magasins/routes/Magasins")
                    return { Component: m.default }
                },
            },
            {
                path: "/bibliotheque",
                handle: {
                    featureKey: "bibliotheque",
                    permissionCode: "bibliotheque.view",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/bibliotheque/routes/Bibliotheque")
                    return { Component: m.default }
                },
            },
            {
                path: "/newsletter",
                handle: {
                    featureKey: "client_newsletter",
                    permissionCode: "newsletter_clients.send",
                    requireMfa: true,
                },
                lazy: async () => {
                    const m =
                        await import("@/features/client-newsletter/routes/ClientNewsletter")
                    return { Component: m.default }
                },
            },
            {
                path: "/profile",
                handle: {
                    featureKey: "profile",
                    permissionCode: "profile.view",
                },
                lazy: async () => {
                    const m = await import("@/features/profile/routes/Profile")
                    return { Component: m.default }
                },
            },
            {
                // Réglages du compte, séparés de l'identité (/profile).
                // Même code d'accès : pas de permission supplémentaire à
                // provisionner en base.
                path: "/settings/:section?",
                handle: {
                    featureKey: "settings",
                    permissionCode: "profile.view",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/settings/routes/Settings")
                    return { Component: m.default }
                },
            },
            {
                path: "/journalsell",
                handle: {
                    featureKey: "journalsell",
                    permissionCode: "journalsell.view",
                },
                lazy: async () => {
                    const { SellJournal } =
                        await import("@/features/sell-journal/routes/SellJournal")
                    const { ProfilesProvider } =
                        await import("@/shared/context/ProfilesProvider")
                    const { SellJournalProvider } =
                        await import("@/features/sell-journal/context/SellJournalContext")
                    return {
                        Component: () => (
                            <ProfilesProvider>
                                <SellJournalProvider>
                                    <SellJournal />
                                </SellJournalProvider>
                            </ProfilesProvider>
                        ),
                    }
                },
            },
            {
                path: "/veille",
                handle: {
                    featureKey: "veille",
                    permissionCode: "veille.view",
                },
                lazy: async () => {
                    const m = await import("@/features/veille/routes/Veille")
                    return { Component: m.default }
                },
            },
            {
                path: "/veille-admin",
                handle: {
                    featureKey: "veille_admin",
                    permissionCode: "veille.admin",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/veille/routes/VeilleAdmin")
                    return { Component: m.default }
                },
            },
            {
                path: "/wiki",
                handle: {
                    featureKey: "wiki",
                    permissionCode: "wiki.view",
                },
                lazy: async () => {
                    const m = await import("@/features/wiki/routes/Wiki")
                    return { Component: m.default }
                },
            },
            {
                // :tab? optionnel — l'URL plate /arrivage-admin continue de
                // matcher et redirige vers l'onglet par défaut (docs/ROUTING.md).
                // :detail? porte l'id d'un envoi, pour ouvrir sa sheet
                // directement (/arrivage-admin/logs/<run_id>).
                path: "/arrivage-admin/:tab?/:detail?",
                handle: {
                    featureKey: "arrivage_admin",
                    permissionCode: "stock.arrivage.newsletter.admin",
                },
                lazy: async () => {
                    const m =
                        await import("@/features/arrivage-admin/routes/ArrivageAdmin")
                    return { Component: m.default }
                },
            },
            {
                // Console de supervision de `packing-api`.
                // `:section?` et non `:tab?` : c'est le nom que `TabbedModuleRoute`
                // lit dans `useParams`. `:detail?` porte l'id d'un import, pour
                // ouvrir sa sheet directement (/packing-admin/imports/<uuid>).
                //
                // `requireMfa` est OBLIGATOIRE : le service exige `aal2` sur chaque
                // appel et la RLS packing impose `auth_session_is_aal2()`. Sans ce
                // garde, la console s'ouvrirait et ne renverrait que des 403.
                path: "/packing-admin/:section?/:detail?",
                handle: {
                    featureKey: "packing_admin",
                    permissionCode: "stock.packing.admin",
                    requireMfa: true,
                },
                lazy: async () => {
                    const m = await import(
                        "@/features/packing-admin/routes/PackingAdmin"
                    )
                    return { Component: m.default }
                },
            },
            {
                path: "/crm-admin",
                handle: {
                    featureKey: "crm_admin",
                    permissionCode: "crm.view",
                    requireMfa: true,
                },
                lazy: async () => {
                    const { default: CrmAdmin } =
                        await import("@/features/crm/routes/CrmAdmin")
                    const { CRMProvider } =
                        await import("@/features/crm/context/CRMContext")
                    const { DevisProvider } =
                        await import("@/features/crm/context/DevisContext")
                    return {
                        Component: () => (
                            <CRMProvider>
                                <DevisProvider>
                                    <CrmAdmin />
                                </DevisProvider>
                            </CRMProvider>
                        ),
                    }
                },
            },
            {
                path: "*",
                lazy: async () => {
                    const m =
                        await import("@/features/notfound/routes/NotFound")
                    return { Component: m.default }
                },
            },
        ],
    },
])
