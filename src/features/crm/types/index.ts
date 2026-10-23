/**
 * index.ts — Point d'entrée unique des types CRM
 *
 * Importer depuis : `@/features/crm/types`
 *
 * Organisation :
 *   user.ts      → CRMUser, Owner, Search, EventCustomerRef
 *   client.ts    → Client, FicheAppro, ActiveTab, ClientFilters, BoardData
 *   calendar.ts  → Event_creation, CalendarView, EventTypeDef, OwnerColumn
 *   task.ts      → Tache, TacheInsert, ClientType, FilterType
 *   quote.ts     → Devis, LigneProduit, QuoteProduct, Product, Fournisseur, DevisTableau, AddressItem
 *   activity.ts  → activites, ActiviteInput
 *   analytics.ts → PeriodType, WidgetId, SectionKey
 *   briefOptions.ts → BriefCategorie, BriefOption, BRIEF_CATEGORIES
 */

export type {
    CRMUser,
    Owner,
    EventCustomerRef,
    CustomerObject,
    CustomerRef,
    Search,
} from "./user"

export type {
    Vente,
    Recherche,
    FicheAppro,
    Client,
    ActiveTab,
    TaskStatus,
    ClientFilters,
    FilterInput,
    BoardData,
} from "./client"

export type {
    CalendarView,
    EventTypeDef,
    Event_creation,
    EventDateRange,
    OwnerColumn,
} from "./calendar"

export type {
    ClientType,
    Tache,
    TacheInsert,
    FilterType,
} from "./task"

export type {
    Payment,
    LigneProduit,
    QuoteProduct,
    Devis,
    UrgenceLevel,
    DevisTableau,
    Product,
    Fournisseur,
    Type_CRM,
    AddressItem,
} from "./quote"

export type { activites, ActiviteInput } from "./activity"

export type {
    PeriodType,
    WidgetId,
    SectionKey,
    SectionSize,
    SectionLayoutItem,
} from "./analytics"
export {
    DEFAULT_SECTION_ORDER,
    DEFAULT_SECTION_LAYOUT,
    isSectionKey,
    isSectionSize,
} from "./analytics"

export type { BriefCategorie, BriefOption } from "./briefOptions"
export { BRIEF_CATEGORIES } from "./briefOptions"
