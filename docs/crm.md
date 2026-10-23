# CRM — Documentation technique

## Vue d'ensemble

La feature **CRM** est le module de gestion de la relation client de La Console. Elle couvre cinq domaines :

| Onglet | Domaine |
|---|---|
| **Calendrier** | Événements commerciaux (RDV, appels, indisponibilités) |
| **Clients** | Fiches client, pipeline Kanban, gestion des leads |
| **Tâches** | Suivi des tâches par commercial |
| **Devis** | Création, suivi et archivage des devis |
| **Analytics** | KPIs, graphiques d'activité, tunnel de vente |

---

## Architecture

```
routes/SinglePageCRM.tsx       → Point d'entrée, TabsList des 5 onglets
      ↓
CRMContext (context/CRMContext.tsx)
  ├── useEvent        → Event_calendar (Supabase + real-time)
  ├── useClient       → client_crm (Supabase + real-time)
  ├── useActivites    → Client_activite (Supabase + real-time)
  ├── useDevis        → devis_gestion (Supabase)
  ├── useTache        → Tache_crm (Supabase + real-time)
  └── useProduct      → produits (Supabase)
      ↓
Contexts spécialisés (CalendarContext, CustomerContext, DevisContext…)
      ↓
Composants de tab et sous-composants
```

### Flux de données

```
Supabase (DB + real-time channels)
      ↓
Hooks bas niveau (use_calendar, use_client, use_tache…)
      ↓ data exposée via useMemo
CRMContext               → état global partagé entre tous les onglets
      ↓
Contexts spécialisés     → état UI isolé par onglet (CalendarContext, CustomerContext…)
      ↓
Composants de board / card / modal / form
```

---

## Fichiers — carte complète

### Routes

| Fichier | Rôle |
|---|---|
| `routes/SinglePageCRM.tsx` | Page principale, TabsList des 5 onglets + overlay fiche client |

### Tabs (entrées d'onglet)

| Fichier | Rôle |
|---|---|
| `CalendarTab.tsx` | Calendrier avec vues jour/semaine/mois/année |
| `CustomersTab.tsx` | Gestion clients (Kanban + table) |
| `Tachetab.tsx` | Gestion des tâches |
| `QuotesTab.tsx` | Gestion des devis |
| `AnalyticsTab.tsx` | Dashboard analytique |

### Contexts

| Fichier | Rôle |
|---|---|
| `context/CRMContext.tsx` | Context central — tous les hooks + état UI partagé |
| `context/AnalyticsContext.tsx` | KPIs, graphiques, filtres, widgets analytics |
| `context/CalendarContext.tsx` | Navigation calendrier, vue, filtres équipe |
| `context/CustomerContext.tsx` | Liste clients, filtres, vue board/table |
| `context/DevisContext.tsx` | Formulaire devis (produits, remises, TVA, adresses) |
| `context/TaskPageContext.tsx` | Liste tâches filtrées, modales |

### Hooks (bas niveau)

| Fichier | Rôle |
|---|---|
| `hooks/CRM_hook/use_calendar.tsx` | CRUD événements + real-time + envoi mail Go |
| `hooks/CRM_hook/use_client.tsx` | CRUD clients + real-time + optimistic update |
| `hooks/CRM_hook/use_activites.tsx` | CRUD activités + real-time anti-doublon |
| `hooks/CRM_hook/use_tache.tsx` | CRUD tâches + real-time (user + global) |
| `hooks/CRM_hook/use_devis.tsx` | CRUD devis |
| `hooks/CRM_hook/use_product.tsx` | CRUD produits/catalogue |
| `hooks/CRM_hook/use_fournisseur.tsx` | CRUD fournisseurs |
| `hooks/CRM_hook/use_type.tsx` | Types d'événements |

### Composants Calendrier

| Fichier | Rôle |
|---|---|
| `components/Calendar/Header.tsx` | Barre de navigation (prev/today/next, sélecteur de vue) |
| `components/Calendar/Filter.tsx` | Filtre utilisateur / équipe |
| `components/Calendar/CalendarGrid.tsx` | Dispatcher → DayView / WeekView / MonthView |
| `components/Calendar/DayView.tsx` | Vue jour : colonnes par commercial, drag & resize |
| `components/Calendar/WeekView.tsx` | Vue semaine : grille 7 jours, drag & resize (anime.js) |
| `components/Calendar/MonthView.tsx` | Vue mois / sélecteur d'année |
| `components/Calendar/sidebar_event.tsx` | Sidebar : liste événements du jour sélectionné |
| `components/Calendar/createEventLogic.ts` | Hook + constantes pour la création/édition d'événement |
| `components/CreationSplit/EventFormPanel.tsx` | Panneau formulaire (gauche) |
| `components/CreationSplit/EventGridPanel.tsx` | Panneau prévisualisation (droite) |

### Composants Clients

| Fichier | Rôle |
|---|---|
| `components/Client/creation_client.tsx` | Modal création/édition client (SIRET, TVA, contacts) |
| `components/Client/fiche.tsx` | Fiche client complète (brief, activités, devis, tâches) |
| `components/Client/Fiche_split/colonneg.tsx` | Panneau gauche : infos, RDV, contacts |
| `components/Client/Fiche_split/colonner.tsx` | Panneau droit : devis / factures |
| `components/Client/Fiche_split/colonneBrief.tsx` | Formulaire brief boutique (`FicheAppro`) |
| `components/Client/Fiche_split/stats.tsx` | Cartes KPI client (CA, impayés, panier moyen) |
| `components/Client/Fiche_split/activiter.tsx` | Timeline d'activités |
| `components/Client/Fiche_split/creation_event.tsx` | Modal ajout d'événement depuis la fiche |

### Composants Customer Tab

| Fichier | Rôle |
|---|---|
| `components/CustomerTabSplit/FilterBar.tsx` | Filtres : recherche, user, date, budget, tâche |
| `components/CustomerTabSplit/CustomerBoard.tsx` | Vue Kanban (colonnes pipeline 0-8) |
| `components/CustomerTabSplit/KanbanColumn.tsx` | Colonne unique avec cards |
| `components/CustomerTabSplit/ClientCard.tsx` | Card client : badges, timer, actions |
| `components/CustomerTabSplit/TableView.tsx` | Vue table configurable |
| `components/CustomerTabSplit/LiveTimer.tsx` | Timer dynamique "depuis dernière activité" |
| `components/CustomerTabSplit/AssignModal.tsx` | Modal d'assignation à un commercial |

### Composants Devis

| Fichier | Rôle |
|---|---|
| `components/Devis/creation.tsx` | Dialog de création de devis |
| `components/Devis/Header_Devis.tsx` | En-tête avec filtres et stats |
| `components/Devis/KPI.tsx` | Cartes statistiques devis |
| `components/Devis/ActiveQuotes.tsx` | Liste devis actifs |
| `components/Devis/Archives.tsx` | Devis archivés |
| `components/Devis/QuoteCard.tsx` | Card individuelle d'un devis |
| `components/Devis/pdfvisuel.tsx` | Prévisualisation PDF |
| `components/Devis/Creation_Split/firstrow.tsx` | Client + dates |
| `components/Devis/Creation_Split/produit.tsx` | Recherche et ajout de produits |
| `components/Devis/Creation_Split/TableauProd.tsx` | Tableau des produits (qté, prix, remise) |
| `components/Devis/Creation_Split/paiementtab.tsx` | Mode de paiement |
| `components/Devis/Creation_Split/taxandbilling.tsx` | TVA, HT/TTC |
| `components/Devis/Creation_Split/action.tsx` | Boutons (enregistrer, PDF, envoyer) |

### Composants Analytics

| Fichier | Rôle |
|---|---|
| `components/Analytics/Header.tsx` | Filtres période + commercial + visibilité widgets |
| `components/Analytics/Kpis.tsx` | Cartes KPI (CA, devis, leads, clients, taux conversion) |
| `components/Analytics/Charts.tsx` | Container de tous les widgets (AnimatePresence) |
| `components/Analytics/Widget/Revenue.tsx` | Graphique évolution CA (area + line) |
| `components/Analytics/Widget/RDVPerformance.tsx` | Évolution RDV dans le temps (line chart) |
| `components/Analytics/Widget/RDVByPerson.tsx` | RDV par commercial (stacked bar) |
| `components/Analytics/Widget/ActivityType.tsx` | Répartition types d'activités (bar) |
| `components/Analytics/Widget/ActivityOwner.tsx` | Activités par membre (stacked bar) |
| `components/Analytics/Widget/ShowNoShow.tsx` | Taux show/no-show (donut) |
| `components/Analytics/Widget/Provenance.tsx` | Origines clients (bar) |
| `components/Analytics/Widget/Tunneldevente.tsx` | Tunnel de vente (barres animées) |

### Modales

| Fichier | Rôle |
|---|---|
| `modales/EventDetailsModal.tsx` | Popup résumé d'événement (type, client, lieu, heure) |
| `modales/TaskModals.tsx` | Modales édition / confirmation suppression tâche |

### Utilitaires

| Fichier | Rôle |
|---|---|
| `utils/safeDate.ts` | Protection contre les crashs "Invalid time value" |
| `utils/joursFeries.ts` | 11 jours fériés français (algo Butcher/Meeus) |
| `utils/distance.ts` | Calcul et formatage distance/durée de trajet |
| `components/types.ts` | `CalendarView` type |

---

## Domaine typologique

### Événement calendrier (`use_calendar.tsx`)

```ts
interface Event_creation {
    id?:             string
    owner?:          string | null         // user_id du commercial responsable
    nom?:            string | null         // type d'événement (ex: "rdv visio achat")
    id_client?:      string | null         // FK vers client_crm
    clientProfile?:  Client | null         // jointure optionnelle
    debut:           string                // ISO datetime
    fin:             string | Date         // ISO datetime
    mail?:           string[] | null       // emails pour confirmation automatique
    participants:    string | null         // nom affiché du client
    lieu:            string | null
    description:     string | null
    client?:         string | null         // nom brut (legacy)
    customer?:       string | null         // user_id du commercial (colonne DB)
    creator_id?:     string | null
    show?:           boolean | null        // présence confirmée (show/no-show)
}
```

### Client (`use_client.tsx`)

```ts
interface Client {
    id?:               string
    nom:               string | null
    societe:           string | null
    telephone:         string | null
    telephone_2?:      string | null
    mail:              string | null
    mail_2?:           string | null
    siret:             string | null
    numero_TVA?:       string | null
    localisation:      string | null
    insta?:            string | null
    collum?:           number | null      // étape pipeline (0–8)
    brief?:            FicheAppro | string | null  // sérialisé JSON en DB
    depense?:          number | null
    commandes?:        string | null
    updated_at?:       string | null
    created_at?:       string | null
    prise_en_charge?:  string | null
    message?:          string | null
    customer?:         Owner | null       // commercial setter (jointure profiles)
    closers?:          Owner | null       // commercial closer (jointure profiles)
    adresse_livraison?:  string[] | string
    adresse_facturation?: AddressEntry[]
}
```

**`FicheAppro` — brief boutique :**

```ts
interface FicheAppro {
    vendDeja:        Vente[]          // produits vendus actuellement
    recherche:       Recherche[]      // recherches d'approvisionnement
    boutiqueType?:   string
    surface?:        string | number
    plateformes?:    string[]
    localisationType?: string
    activiteType?:   string
    vintage?:        boolean
    vintageDepuis?:  string
    budget:          number
    budgetRange?:    string           // "low" | "mid" | "high"
    budgetValid?:    boolean
    type?:           string[] | string
    ville?:          string
    pays?:           string
    Horizon?:        string
    collum?:         number           // étape pipeline miroir
    besoinsHomme?:   string[]
    besoinsFemme?:   string[]
    Note:            string
    evaluationRange: number[]
    marques:         string[]
    Matiere?:        string[]
    provenance?:     string
    canalVente?:     string
    approvisionnement?: string
    language?:       string           // "fr" | "en" — pour les mails auto
}
```

> **Sérialisation :** `brief` est stocké en **JSON string** dans Supabase. Le hook le parse automatiquement au fetch et le stringify avant chaque update.

### Activité (`use_activites.tsx`)

```ts
interface activites {
    id:          string
    client:      string                          // FK vers client_crm
    date:        string                          // date de l'activité (choix user)
    created_at?: string                          // timestamp système
    title?:      string
    content?:    string
    rdv?:        Event_creation                  // événement lié optionnel
    owner?:      string | { user_id: string; full_name: string }
}
```

**Tri stable :** `date desc` → `created_at desc` → `id asc` (protège contre les NaN).

### Tâche (`use_tache.tsx`)

```ts
interface Tache {
    id:         string
    type:       string                           // type de tâche (libre)
    client:     string | ClientType | null       // UUID ou objet joint { id, nom }
    content:    string | null
    date:       string | null
    valide?:    boolean | null
    owner?:     string | null                    // user_id du responsable
    placement?: string | null
}
```

**Deux listes distinctes :**
- `Tache` — tâches de l'utilisateur connecté
- `AllTache` — toutes les tâches (admin / vue globale)

### Devis

Les types complets sont dans `hooks/CRM_hook/use_devis.tsx`. Les champs principaux :

```ts
interface Devis {
    id:              string
    status:          string            // "actif" | "archivé" | "refusé" | ...
    client_id?:      string
    created_by:      string
    created_at:      string
    products:        Product[]
    totalHT:         number
    totalTVA:        number
    totalTTC:        number
    discountType?:   string
    discountPercent?: number
    TVA?:            number
    paymentMethod?:  string
    // ... autres champs de contexte de livraison / facturation
}
```

---

## Types de vues et navigation

```ts
type CalendarView = "day" | "week" | "month" | "year"

// Pipeline client — valeurs de collum (0-8)
// 0 = Nouveau lead
// 1-7 = Étapes commerciales configurables
// 8 = No Show
```

---

## Système de contexts

### `CRMContext` (context central)

Toutes les données et méthodes partagées entre les 5 onglets.

**État exposé :**

| Variable | Type | Rôle |
|---|---|---|
| `activeTab` | `string` | Onglet actif |
| `calendarView` | `CalendarView` | Vue calendrier active |
| `events` | `Event_creation[]` | Tous les événements |
| `clients` | `Client[]` | Tous les clients |
| `activites` | `activites[]` | Activités du client ouvert |
| `Tache` | `Tache[]` | Tâches de l'utilisateur |
| `AllTache` | `Tache[]` | Toutes les tâches |
| `Devis` | `Devis[]` | Devis chargés |
| `Produit` | `Product[]` | Catalogue produits |
| `selectedClient` | `Client \| null` | Client sélectionné (fiche ouverte) |
| `eventToEdit` | `Event_creation` | Événement en cours d'édition |
| `FicheClient` | `boolean` | Fiche client ouverte |
| `creationclient` | `boolean` | Modal création client ouverte |
| `creation` | `boolean` | Modal création événement ouverte |
| `Update` | `boolean` | Mode édition événement |
| `fiche` | `FicheAppro` | Brief boutique en cours d'édition |
| `date` | `Date` | Date sélectionnée dans le calendrier |
| `searchTerm` | `string` | Recherche devis |
| `statusFilter` | `string` | Filtre statut devis |
| `clientFilter` | `string` | Filtre client devis |
| `combinedFilter` | `string` | Filtre combiné devis (persisté localStorage) |
| `allUsers` | `Search[]` | Membres de l'équipe |
| `clientToOpen` | `Client \| null` | Client à ouvrir automatiquement |

**Méthodes exposées :**

```ts
// Calendrier
fetch_calendar_event(userId?: string)
create_event_calendar(event: Event_creation)
update_Event(event: Event_creation)
deleteEvent(id: string)
isSlotBusy(targetId, newStart, newEnd, excludeId?)
getDayEvents(date: Date)
eventIntersectsDay(event, date)
handleOpenEventSummary(event)
scrollToEvent(id)

// Clients
fetch_client(userId?: string)
create_fiche_client(client: Client)
update_fiche_client(changes: Partial<Client> & { id: string })
delete_fiche_client(id: string)
openClientFiche(client: Client)

// Activités
fetch_activite(clientId?: string)
create_activites(activite: ActiviteInput)
update_Activites(act: Partial<activites>)
delete_activites(id, clientId?)

// Devis
fetchDevisByUser(params: fetchDevisType)
Register_devis(devis: Devis)
Update_devis(id, updates)
DeleteDevis(id)

// Tâches
fetch_Tache()
create_Tache(tache: Partial<Tache>)
update_Tache(id, updates)
delete_Tache(id)
```

### `CalendarContext`

```ts
// État
date: Date                        // date navigable courante
calendarView: CalendarView        // vue active
userFilter: string | "all"        // filtre commercial ("mine" forcé en vue semaine)
isSidebarOpen: boolean
selectedEventInfo: Event_creation | null
teamMembers: Search[]             // équipe hors user connecté

// Méthodes
handleNavigate(direction: "prev" | "next")
goToToday()
handleCreateEvent(targetDate?: Date)
headerTitle: string               // titre memoïsé pour la vue courante
```

**Contrainte :** en vue `"week"`, le filtre bascule automatiquement sur `"mine"` — la vue d'équipe n'est pas disponible en semaine.

### `CustomerContext`

```ts
// État
activeTab: "acquisition" | "fidelisation"
viewMode: "board" | "table"
searchTerm: string
filters: { user, date, budget, task }
visibleColumns: string[]           // colonnes affichées en table view (role-based defaults)

// Computed (useMemo)
filteredClients: Client[]
boardData: Record<number, Client[]>    // clients groupés par collum (pipeline)
clientTaskMap: Map<string, "green"|"red"|"gray"|"notask"|"none">
hasActiveFilters: boolean

// Méthodes
refreshData()
handleNewLead()
handleClientClick(client: Client)
```

### `DevisContext`

```ts
// État groupé
products: Product[]                // produits ajoutés au devis
discountType: string
discountPercent: number
TVA: number
paymentMethod: string
Livraison: number
note: string
adresseLivraison: string
adresseFacturation: AddressEntry
savedAddresses: AddressEntry[]
datedesaisis: string
expirationDate: string

// Computed
totals: { totalHT, totalTVA, totalTTC }
payments: Payment[]
AvoirValue: number
remises: Remise[]

// Méthodes
prepareDevis()                    // formate les données pour l'envoi
loadQuoteData(devis: Devis)       // charge un devis existant dans le formulaire
addAddressToHistory(address)
removeAddressFromHistory(address)
```

### `TaskPageContext`

```ts
// État
activeFilter: "today" | "venir" | "retard" | "tout"
filteredTasks: Tache[]            // useMemo sur Tache + activeFilter
openEditModal: boolean
editTask: Tache | null

// Méthodes
toggleDone(task)                  // marque complète → crée activité + supprime tâche
saveTask(updates)
executeDelete(id)
handleClientClick(client)
taskCount(filter): number
```

---

## Types d'événements calendrier

Définis dans `createEventLogic.ts` :

| Valeur | Label | Couleur |
|---|---|---|
| `rdv physique achat` | RDV physique achat | `bg-green-500` |
| `rdv physique decouverte` | RDV physique découverte | `bg-purple-500` |
| `rdv visio achat` | RDV visio achat | `bg-indigo-500` |
| `rdv decouverte visio` | RDV visio découverte | `bg-blue-500` |
| `appel` | Appel | `bg-orange-500` |
| `Non Disponible` | Non Disponible | `bg-red-500` |
| `other` | Autre | `bg-gray-500` |

**Constantes de grille :**

```ts
export const START_HOUR   = 7    // heure de début de la grille
export const END_HOUR     = 21   // heure de fin de la grille
export const HOUR_HEIGHT  = 60   // px par heure
export const TIME_SLOTS   = ...  // intervalles de 15 min (00:00–23:45)
```

---

## Comportements clés

### Real-time Supabase

Les trois hooks principaux maintiennent des **channels Supabase** actifs :

| Hook | Table écoutée | Stratégie |
|---|---|---|
| `use_calendar` | `Event_calendar` | Fetch complet de l'événement (avec jointures) à chaque payload INSERT/UPDATE |
| `use_client` | `client_crm` | Fetch complet du client (avec jointures) à chaque payload INSERT/UPDATE |
| `use_tache` | `Tache_crm` | Fetch complet de la tâche (avec jointure client) pour avoir le nom joint |
| `use_activites` | `Client_activite` | Filtré par `clientId` — canal par client ouvert |

**Problème classique :** `payload.new` de Supabase ne contient que les IDs, pas les objets joints. La solution systématique est de faire un `fetchOne*WithRelations()` après chaque notification.

### Optimistic updates

- `use_client.update_fiche_client` : mise à jour locale immédiate → envoi Supabase → `fetchOneClient()` pour confirmer, rollback en cas d'erreur.
- `use_tache.update_Tache` / `delete_Tache` : mise à jour locale → envoi Supabase → `fetch_Tache()` en rollback si erreur.
- `use_activites.create_activites` : insertion optimiste avec `tempId` → remplacement par le vrai `id` DB → mécanisme `recentlyInsertedIdsRef` pour éviter le doublon avec le channel real-time.
- `use_calendar.create_event_calendar` : insertion optimiste avec `tempId` → remplacement par `id` DB après insert.

### Envoi mail automatique

À la création d'un événement, si `event.mail` est renseigné et que le type n'est pas `"Non Disponible"`, un appel HTTP POST est déclenché vers le service Go :

```
POST https://info.nokk-project.example/no_repleid_rdv
{
  client_email: string[],
  client_nom:   string,
  date_rdv:     "DD/MM/YYYY",
  heure_rdv:    "HHhMM",
  owner:        string,        // user_id → Go cherche le nom complet
  langue:       "fr" | "en",  // détecté via brief.language du client
  type_rdv:     string
}
```

La langue est déduite du champ `brief` du client (`"language":"en"` dans le JSON).

### Détection No-Show

Quand `update_Event` est appelé avec `event.show === false` et un `id_client` renseigné, le client est automatiquement déplacé en `collum: 8` (colonne "No Show") dans `client_crm`.

### Validation SIRET

Dans `creation_client.tsx`, le champ SIRET déclenche un appel **debouncé (1 s)** vers l'API externe :

```
GET https://info.nokk-project.example/siret/{siret}
```

En cas de succès, le numéro TVA est auto-rempli depuis la réponse.

### Auto-save brief client

Dans `fiche.tsx`, les modifications du brief `FicheAppro` sont sauvegardées :
- **Immédiatement** dans `localStorage` (clé basée sur l'ID client)
- **Après 800 ms de debounce** en DB via `update_fiche_client()`

### Persistance localStorage

| Clé | Valeur | Utilisation |
|---|---|---|
| `crm_activeTab` | `StockTab` | Onglet CRM actif à la reprise |
| `crm_combinedFilter` | `string` | Filtre devis actif |
| `brief_${clientId}` | `JSON` | Brief client en cours d'édition |

---

## Utilitaires

### `safeDate.ts`

```ts
safeDate(value: unknown): Date | null
// Retourne null si value est null, "", undefined ou produit une date invalide.
// Protège contre les crashs "Invalid time value".

safeDateMs(value: unknown): number
// Retourne 0 si invalide — safe pour les comparaisons de tri.
```

### `joursFeries.ts`

```ts
getJoursFeries(year: number): JourFerie[]
// 11 jours fériés français. Pâques calculé via algorithme Butcher/Meeus.

getJourFerie(day: Date): string | null
// Retourne le nom du jour férié ou null.
```

**Jours fériés couverts :** Jour de l'An, Lundi de Pâques, Fête du Travail, Victoire 1945, Ascension, Lundi de Pentecôte, Fête Nationale, Assomption, Toussaint, Armistice, Noël.

### `distance.ts`

```ts
calculateDistance(destination: string, origin?: string): DistanceResult
// Appelle l'API Distancer (auth Supabase). Retourne { meters, seconds }.

formatDistance(result: DistanceResult): string
// Retourne "X km · Yh Zm"
```

---

## Supabase — tables impliquées

| Table | Rôle | Écriture front |
|---|---|---|
| `Event_calendar` | Événements calendrier | Oui (CRUD complet) |
| `client_crm` | Fiches clients | Oui (CRUD complet) |
| `Client_activite` | Timeline d'activités | Oui (CRUD complet) |
| `Tache_crm` | Tâches commerciales | Oui (CRUD complet) |
| `devis_gestion` | Devis | Oui (CRUD complet) |
| `produits` | Catalogue produits | Oui (CRUD via use_product) |
| `profiles` | Membres de l'équipe | Non — lecture seule (jointures) |

**Select avec relations pour `client_crm` :**
```ts
"*, customer(id, user_id, full_name), closers(id, user_id, full_name)"
```

---

## Analytics — widgets disponibles

Configurés dans `AnalyticsContext.DEFAULT_WIDGET_CONFIG` :

| ID | Composant | Type de graphique |
|---|---|---|
| `revenue` | `Revenue.tsx` | Area + line (CA évolution) |
| `rdvPerformance` | `RDVPerformance.tsx` | Line multi-séries (RDV dans le temps) |
| `rdvByPerson` | `RDVByPerson.tsx` | Stacked bar (RDV par commercial) |
| `activityType` | `ActivityType.tsx` | Bar (types d'activités) |
| `activityOwner` | `ActivityOwner.tsx` | Stacked bar (activités par membre) |
| `showNoShow` | `ShowNoShow.tsx` | Donut (taux présence) |
| `provenance` | `Provenance.tsx` | Bar (origines clients) |
| `tunneldevente` | `Tunneldevente.tsx` | Barres animées (pipeline) |

**Types de période :**

```ts
type PeriodType = "week" | "month" | "quarter" | "year"
```

**Palette de couleurs** (`CHART_COLORS`) : 9 couleurs fixes utilisées dans tous les graphiques pour la cohérence visuelle.

Chaque widget est **toggleable** via le menu de visibilité dans `Analytics/Header.tsx`. L'état est géré dans `AnalyticsContext.widgets`.

---

## Recettes

### Ajouter un type d'événement calendrier

1. Ajouter l'entrée dans `EVENT_TYPES` (`createEventLogic.ts`) avec `value`, `label`, `color`, `btnColor`
2. Mettre à jour le sélecteur dans `EventFormPanel.tsx`
3. Si le comportement au no-show doit être étendu, mettre à jour `update_Event` dans `use_calendar.tsx`

### Ajouter un champ à la fiche client

1. Ajouter le champ dans l'interface `Client` (`use_client.tsx`)
2. Ajouter dans `ClientUpdatePayload` si la sérialisation DB diffère (JSON, FK…)
3. Ajouter le champ dans le payload de `create_fiche_client`
4. Ajouter le contrôle UI dans `creation_client.tsx` ou la section appropriée de `fiche.tsx`

### Ajouter un filtre client (CustomerContext)

1. Ajouter le champ dans l'état `filters` de `CustomerContext`
2. Ajouter la condition dans le `useMemo` de `filteredClients`
3. Ajouter le contrôle UI dans `CustomerTabSplit/FilterBar.tsx`

### Ajouter un champ au brief (`FicheAppro`)

1. Ajouter le champ dans `FicheAppro` (`use_client.tsx`)
2. Ajouter le contrôle dans `colonneBrief.tsx` (formulaire brief)
3. Le champ sera automatiquement sérialisé/désérialisé par le hook

### Ajouter un widget analytics

1. Créer le composant dans `components/Analytics/Widget/`
2. Ajouter l'`id` dans le type `WidgetId` et dans `DEFAULT_WIDGET_CONFIG` (`AnalyticsContext`)
3. Ajouter la donnée calculée dans `AnalyticsContext` via `useMemo`
4. Ajouter le rendu conditionnel dans `Analytics/Charts.tsx`

### Créer une nouvelle étape pipeline

Le pipeline est piloté par le champ `collum` (entier 0–8) dans `client_crm` :
1. Mettre à jour les labels de colonnes dans `CustomerTabSplit/CustomerBoard.tsx`
2. Si une nouvelle valeur de `collum` est introduite, mettre à jour tous les endroits qui filtrent ou affichent par `collum` (`boardData`, `ClientCard`, `TableView`)
3. La valeur 8 est réservée aux "No Show" (affectée automatiquement par `update_Event`)

---

## Checklist lors de l'ajout d'un domaine

- [ ] Interface entity dans `hooks/CRM_hook/use_*.tsx`
- [ ] Hook avec fetch, create, update, delete, realtime
- [ ] Hook branché dans `CRMContext` + méthodes re-exposées
- [ ] Test unitaire dans `hooks/CRM_hook/use_*.test.tsx`
- [ ] Permissions Supabase vérifiées (RLS)
- [ ] Si entité liée à un client : `touchClientTimestamp()` après mutation pour mettre à jour `updated_at`
