# Routing par URL — onglets et deep-linking

## Vue d'ensemble

Convention transverse pour toute feature qui a des onglets et/ou une ressource de détail (sheet, fiche) à ouvrir : **l'URL doit être l'unique source de vérité** de ce qui est affiché, jamais dupliquée dans un Context + `localStorage`. Deux raisons :

1. **Deep-linking** : une notification, un lien externe ou un signet doit pouvoir ouvrir directement un onglet précis, ou une ressource précise (ex : la sheet d'édition d'un arrivage), sans passer par un état applicatif reconstruit côté client.
2. **Navigateur cohérent** : bouton retour, rechargement (F5), partage de lien — tout doit refléter fidèlement ce qui est affiché.

Ce document a été écrit à l'occasion de la migration de `src/features/stock` (onglet Arrivages) vers ce modèle. `src/features/administration` suit déjà ce modèle depuis le début et sert de référence canonique. `src/features/projects` a été migré ensuite et sert de référence pour le cas hiérarchique (§ « Modèle hiérarchique »). `src/features/crm` a un système de deep-link plus ancien et plus complexe, à connaître pour ne pas le reproduire (voir §4).

---

## Contrat d'URL

```
/<feature>/:section?/:detail?
```

- `section` : identifiant de l'onglet actif (ex : `arrivage`, `clients`, `agenda`). Absent, inconnu ou non visible → redirection `replace` vers la section par défaut.
- `detail` : optionnel, pilote l'ouverture d'une ressource de détail sur cette section (un id, ou un mot-clé comme `new` pour un formulaire de création). Absent → rien d'ouvert. Invalide (id inconnu une fois les données chargées) → redirection `replace` vers `/<feature>/<section>` (sans crash, sans erreur bloquante).

**Règle push vs replace :**
- Corriger une URL invalide/incomplète vers sa forme canonique → `navigate(path, { replace: true })` (pas de nouvelle entrée d'historique).
- Ouvrir une ressource suite à une action utilisateur (changer d'onglet, ouvrir une sheet) → `navigate(path)` en **push**, pour que le bouton retour du navigateur défasse l'action (ferme la sheet, revient à l'onglet précédent).

---

## Modèle canonique — onglets simples

Référence : `src/features/administration/routes/Administration.tsx`, route `/administration/:tab?`.

```tsx
const { tab } = useParams()
const navigate = useNavigate()

const activeTab = visibleTabs.some(t => t.value === tab) ? tab : visibleTabs[0]?.value

useEffect(() => {
    if (activeTab && tab !== activeTab) {
        navigate(`/administration/${activeTab}`, { replace: true })
    }
}, [tab, activeTab, navigate])

// ...
<Tabs value={activeTab} onValueChange={(value) => navigate(`/administration/${value}`)} />
```

Points clés : **un seul `useEffect`**, uni-directionnel (URL → redirection de garde si besoin) ; `activeTab` est un **dérivé de rendu**, jamais un `useState` dupliqué ; changer d'onglet = un simple `navigate()`.

`src/features/analytics/routes/Analytics.tsx` (route `/analytics/:tab?`) applique le même modèle à l'identique : `TAB_DEFS` + `ANALYTICS_TABS` dans `constants.ts`, visibilité par permission, repli sur le premier onglet visible. Il illustre l'intérêt du filtrage par `visibleTabs` : un slug non autorisé dans l'URL (`/analytics/matomo` pour un profil restreint) ne peut pas activer l'onglet, il est redirigé.

---

## Modèle étendu — onglets + sheet de détail

Référence : `src/features/stock/routes/Stock.tsx` + `src/features/stock/components/flow/FlowBoard.tsx`, route `/stock/:section?/:detail?`.

`Stock.tsx` reprend exactement le modèle Administration pour la section, et transmet `detail` en props à l'onglet actif. Le composant propriétaire de l'onglet (ici `FlowBoard`) dérive l'état de sa sheet depuis `detail`, sans introduire de second `useEffect` bidirectionnel :

```tsx
// FlowBoard.tsx — detail vient des params de route, transmis en prop
const creationOpen = detail === "new"
const editRow = detail && detail !== "new"
    ? rows?.find(r => r.id === detail) ?? null
    : null

// Garde : id présent mais introuvable une fois les données chargées
useEffect(() => {
    if (detail && detail !== "new" && rows !== undefined && !editRow) {
        navigate("/stock/flux", { replace: true })
    }
}, [detail, rows, editRow, navigate])

const closeSheet   = () => navigate("/stock/flux")
const openCreation = () => navigate("/stock/flux/new")
const openEdit     = (row) => navigate(`/stock/flux/${row.id}`)
```

Principe : `creationOpen`/`editRow` sont **calculés à chaque rendu**, jamais stockés dans un `useState`. Le seul `useEffect` sert de garde de sécurité (id invalide), pas de synchronisation bidirectionnelle. Résultat : `/stock/flux/new` ou `/stock/flux/{id}` ouvrent directement la bonne sheet dès le chargement de la page (deep-link depuis une notification, F5, lien partagé), et le bouton retour du navigateur ferme la sheet proprement.

---

## Modèle hiérarchique — ressource → vue → détail (+ filtre en query)

Référence : `src/features/projects/routes/projectRoutes.ts`, route `/projects/:projectId?/:view?/:taskId?`.

Quand la feature n'a pas des onglets « à plat » mais une hiérarchie (un projet, puis une vue de ce projet, puis une tâche), le contrat reste le même, avec un segment de plus :

```
/projects                                → accueil (liste des projets)
/projects/:projectId                     → projet, vue par défaut (kanban)
/projects/:projectId/:view               → kanban | list | calendar
/projects/:projectId/:view/:taskId       → sheet de détail d'une tâche
?sprint=<sprintId>                       → sprint actif
```

Deux points de méthode réutilisables :

1. **Un module de route par feature.** `projectRoutes.ts` centralise les constantes (`PROJECT_VIEWS`, `DEFAULT_PROJECT_VIEW`), le constructeur `buildProjectPath()` (testable unitairement, sans React) et le hook `useProjectRouting()` qui expose l'état lu depuis l'URL plus un `go(delta, { replace })` : `go({ taskId: null })` ne touche qu'au segment tâche. Ça évite la concaténation d'URL dispersée dans dix composants.
2. **Path pour la navigation, query pour le filtre.** Le sprint n'est pas une sous-page : c'est un filtre appliqué à la vue courante. Il vit donc en query string (`?sprint=`), ce qui garde le chemin lisible et permet de le changer sans toucher aux segments.

La sélection (`selectedProjectId`, `selectedSprintId`, `detailTask`) est **entièrement dérivée** de l'URL dans `useProjectSelection` / `taskContext` — les setters historiques (`setSelectedProjectId`, `setSelectedSprintId`, `setDetailTask`) ont été conservés comme API mais font désormais un `navigate()`. Conséquence assumée : `/projects` n'auto-sélectionne plus « le dernier projet ouvert » (l'ancien `localStorage` avec TTL 24 h a été supprimé) et affiche l'accueil.

---

## Anti-pattern documenté — ne pas reproduire

`src/features/crm/routes/SinglePageCRM.tsx` (route `/crm/:section?/:detail?`) résout le même problème mais avec une approche plus ancienne et plus fragile :

- **Triple source de vérité** : l'onglet actif vit à la fois dans `CRMContext.activeTab`, dans `localStorage`, et dans l'URL — les trois sont synchronisés manuellement.
- **~6 `useEffect` couplés bidirectionnels** : un effet URL → état, un effet état → URL (avec une fonction `isCanonicalCrmPath()` pour arbitrer push vs replace), plus un fallback legacy `?tab=xxx` en `useSearchParams`.
- Ça fonctionne, mais c'est difficile à faire évoluer sans risquer une boucle d'effets ou une désynchronisation entre les trois sources.

Ne pas copier ce pattern pour une nouvelle feature — suivre le modèle Administration/Stock ci-dessus. L'alignement de CRM sur ce modèle plus simple est un chantier à part, documenté dans [`docs/tickets/crm-routing-migration.md`](./tickets/crm-routing-migration.md).

---

## Notifications et deep-links

Aucune modification n'est nécessaire côté consommation : `src/features/notifications/hooks/Notification_hook/useNotifications.tsx` donne déjà la priorité à `notification.url` s'il est renseigné :

```ts
const target = notification.url?.trim()
    || notificationTypeRoutes[notification.type ?? "system"]
    || "/dashboard"
navigate(target)
```

Pour qu'une notification ouvre une ressource précise, il suffit donc que la ligne insérée en base (trigger SQL ou service front) porte la bonne `url`, ex. `/stock/flux/<uuid>`. Voir `supabase/migrations/20260717120000_arrivage_notification_deeplink.sql` pour un exemple concret (notifications de rappel facture et de journal d'activité sur les arrivages, corrigées pour pointer vers le conteneur précis au lieu de la liste générique `/stock`). Les lignes déjà en base portent l'ancien segment `/stock/arrivage/<uuid>` : elles restent fonctionnelles, `LEGACY_SECTIONS` les traduit en conservant le détail.

---

## Checklist — ajouter des onglets/deep-links à une feature

- [ ] Route déclarée `path: "/<feature>/:section?/:detail?"` dans `src/app/routes/router.tsx` (params toujours optionnels : la route doit continuer à matcher l'URL plate existante pendant la transition).
- [ ] Table de correspondance `section` (segment d'URL, stable) ↔ identifiant interne d'onglet, si l'identifiant interne diffère du segment d'URL souhaité.
- [ ] `useParams`/`useNavigate` dans le composant point d'entrée de la route — pas de `useState` pour l'onglet actif, pas de persistance `localStorage`.
- [ ] Un seul `useEffect` de garde (redirection `replace` si section/detail invalide), jamais de synchronisation bidirectionnelle.
- [ ] **Ce garde vit dans le composant de route, jamais dans un onglet.** Radix `Tabs` rend le contenu d'un onglet une passe de plus après qu'il soit devenu inactif (`Presence` ne le démonte qu'au layout effect suivant) : un onglet qui se redirige lui-même le fait alors avec un `detail` déjà périmé, et l'utilisateur oscille entre l'onglet cliqué et celui qu'il vient de quitter. Précédent : `SettingsBoard` du module stock, corrigé le 2026-08-18 — la canonicalisation des sous-sections est remontée dans `routes/Stock.tsx` via `STOCK_TABS[].details`, l'onglet ne fait plus que dériver.
- [ ] Lors d'une redirection de section, **ne pas reporter le `detail` de l'ancienne section** : `/stock/parametres/categories` refusé ne doit pas devenir `/stock/flux/categories`, où `categories` serait lu comme un id de ressource.
- [ ] Si une sheet de détail existe : état dérivé du paramètre `detail`, ouverture/fermeture via `navigate()` (push pour ouvrir, pour préserver l'historique).
- [ ] Permissions : gating au niveau route pour l'accès global à la feature (`handle.permissionCode`), gating fin par onglet/action au niveau composant (comme `FlowBoard` le fait déjà avec `stock.arrivage.view`).
- [ ] Tester : chargement direct de chaque URL profonde (F5), bouton retour du navigateur, et une notification simulée avec cette `url`.
