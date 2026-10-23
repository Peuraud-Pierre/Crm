# Rapport de dette technique

Généré par `scripts/tech-debt-report.mjs` — voir `docs/PLAN_ASSAINISSEMENT.md` §8.3.
Snapshot au 2026-08-20. Document jetable, régénéré à chaque exécution — ne pas éditer à la main.

## Vue d'ensemble

- Fichiers >400 lignes (god components) : **60**
- Imports Supabase directs hors `services/` : **0**
- Valeurs Tailwind arbitraires (`text-[...]`, `w-[...]`, etc.) : **968**
- Couverture de tests globale (features) : **154/926 fichiers (17%)**

## Par feature

| Feature | Fichiers | Tests | Couverture | God components | Tailwind arbitraire | Supabase direct |
|---|---|---|---|---|---|---|
| crm | 131 | 20 | 15% | 26 | 409 | 0 |
| projects | 88 | 21 | 24% | 0 | 65 | 0 |
| stock | 86 | 2 | 2% | 7 | 50 | 0 |
| content | 72 | 4 | 6% | 2 | 21 | 0 |
| messages | 60 | 11 | 18% | 6 | 35 | 0 |
| manager | 51 | 1 | 2% | 4 | 76 | 0 |
| arrivage-admin | 45 | 2 | 4% | 0 | 1 | 0 |
| bibliotheque | 42 | 41 | 98% | 0 | 0 | 0 |
| administration | 40 | 8 | 20% | 0 | 0 | 0 |
| tickets | 40 | 2 | 5% | 1 | 70 | 0 |
| veille | 31 | 3 | 10% | 3 | 22 | 0 |
| wiki | 27 | 1 | 4% | 1 | 19 | 0 |
| auth | 24 | 9 | 38% | 0 | 2 | 0 |
| calendar-integrations | 24 | 0 | 0% | 1 | 4 | 0 |
| sorters | 22 | 4 | 18% | 0 | 5 | 0 |
| communication | 18 | 0 | 0% | 3 | 144 | 0 |
| gallery | 16 | 4 | 25% | 0 | 19 | 0 |
| sell-journal | 16 | 1 | 6% | 1 | 2 | 0 |
| matomo | 15 | 2 | 13% | 1 | 2 | 0 |
| profile | 15 | 8 | 53% | 0 | 0 | 0 |
| leads | 12 | 1 | 8% | 0 | 0 | 0 |
| settings | 12 | 3 | 25% | 0 | 0 | 0 |
| tournee | 11 | 0 | 0% | 1 | 4 | 0 |
| catalogue | 6 | 0 | 0% | 1 | 2 | 0 |
| notifications | 4 | 0 | 0% | 0 | 3 | 0 |
| pingpong | 3 | 1 | 33% | 2 | 1 | 0 |
| admin | 2 | 0 | 0% | 0 | 0 | 0 |
| analytics | 2 | 1 | 50% | 0 | 0 | 0 |
| dashboard | 2 | 1 | 50% | 0 | 7 | 0 |
| journal | 2 | 0 | 0% | 0 | 0 | 0 |
| mfa | 2 | 1 | 50% | 0 | 3 | 0 |
| error-console | 1 | 0 | 0% | 0 | 1 | 0 |
| home | 1 | 1 | 100% | 0 | 1 | 0 |
| notfound | 1 | 1 | 100% | 0 | 0 | 0 |
| stock_handpick | 1 | 0 | 0% | 0 | 0 | 0 |
| users | 1 | 0 | 0% | 0 | 0 | 0 |

## God components (>400 lignes)

| Fichier | Lignes |
|---|---|
| `src/features/pingpong/routes/PingPong.tsx` | 1807 |
| `src/features/crm/context/AnalyticsContext.tsx` | 1676 |
| `src/features/crm/components/Client/Fiche_split/colonneg.tsx` | 1544 |
| `src/features/crm/components/Client/fiche.tsx` | 1126 |
| `src/features/stock/components/stockboard/livraison/LivraisonCreationSheet.tsx` | 1036 |
| `src/features/crm/components/Client/Fiche_split/colonneBrief.tsx` | 979 |
| `src/features/communication/components/Calendar/WeekView.tsx` | 971 |
| `src/features/messages/core/crypto.ts` | 934 |
| `src/features/crm/components/Client/Fiche_split/creation_event.tsx` | 905 |
| `src/features/messages/hooks/useCryptedChat.ts` | 899 |
| `src/features/manager/components/Changelog/changelogForm.tsx` | 877 |
| `src/features/communication/components/Calendar/Create_event.tsx` | 861 |
| `src/features/crm/hooks/CRM_hook/use_client.tsx` | 818 |
| `src/features/crm/context/CRMContext.tsx` | 769 |
| `src/features/veille/routes/VeilleAdmin.tsx` | 766 |
| `src/features/manager/components/Changelog/Changelog.tsx` | 757 |
| `src/features/pingpong/hooks/Ping_Pong_hook/usePingPong.tsx` | 722 |
| `src/features/content/routes/ContentList.tsx` | 712 |
| `src/features/messages/hooks/usePinManager.ts` | 712 |
| `src/features/crm/context/DevisContext.tsx` | 711 |
| `src/features/tournee/components/Board3D.tsx` | 694 |
| `src/features/crm/components/Client/creation_client.tsx` | 684 |
| `src/features/crm/components/Calendar/DayView.tsx` | 661 |
| `src/features/content/context/ContentProvider.tsx` | 660 |
| `src/features/manager/components/ErrorConsole/CRMLogsPanel.tsx` | 652 |
| `src/features/manager/components/ErrorConsole/ErrorConsole.tsx` | 639 |
| `src/features/veille/routes/Veille.tsx` | 637 |
| `src/features/crm/components/Calendar/WeekView.tsx` | 620 |
| `src/features/messages/hooks/useCryptedGroupChat.ts` | 601 |
| `src/features/crm/components/Devis/Creation_Split/produit.tsx` | 592 |
| `src/features/communication/components/Calendar/DaysViews.tsx` | 573 |
| `src/features/calendar-integrations/amelia/components/AvailabilityEditor.tsx` | 568 |
| `src/features/crm/components/Devis/Creation_Split/firstrow.tsx` | 563 |
| `src/features/crm/modales/TaskModals.tsx` | 554 |
| `src/features/messages/components/ChatUsersSidebar.tsx` | 550 |
| `src/features/crm/components/Analytics/Widget/EventsPalier.tsx` | 545 |
| `src/features/crm/components/Devis/pdfvisuel.tsx` | 540 |
| `src/features/stock/components/stockboard/balle/BalleCreationSheet.tsx` | 534 |
| `src/features/crm/components/Analytics/ExportStatsButton.tsx` | 532 |
| `src/features/crm/components/CustomerTabSplit/TableView.tsx` | 530 |
| `src/features/crm/components/Devis/Creation_Split/action.tsx` | 525 |
| `src/features/messages/components/ChatView.tsx` | 521 |
| `src/features/tickets/components/TicketKanban/TicketInfoPanel.tsx` | 518 |
| `src/features/crm/components/Calendar/sidebar_event.tsx` | 511 |
| `src/features/crm/hooks/CRM_hook/use_calendar.tsx` | 508 |
| `src/features/stock/components/stockboard/balle/BalleSheet.tsx` | 498 |
| `src/features/sell-journal/components/Bilan/BilanDialog.tsx` | 497 |
| `src/features/wiki/components/article/ArticleEditor.tsx` | 494 |
| `src/features/crm/components/Client/Fiche_split/stats.tsx` | 486 |
| `src/features/stock/components/flow/ArrivageLimitedTable.tsx` | 474 |
| `src/features/stock/components/flow/ArrivageLimitedEditSheet.tsx` | 441 |
| `src/features/crm/routes/SinglePageCRM.tsx` | 440 |
| `src/features/matomo/components/MatomoMap.tsx` | 439 |
| `src/features/stock/components/dashboard/sections/BalleSearch.tsx` | 434 |
| `src/features/catalogue/components/Tools/tool_form/CalculetteProForm.tsx` | 426 |
| `src/features/stock/components/flow/ExportArrivageButton.tsx` | 422 |
| `src/features/veille/components/TopicSelector.tsx` | 418 |
| `src/features/crm/components/CustomerTabSplit/FilterBar.tsx` | 417 |
| `src/features/crm/context/CustomerContext.tsx` | 413 |
| `src/features/crm/hooks/CRM_hook/useCreateEventLogic.ts` | 412 |

## Features sans aucun test

- admin
- calendar-integrations
- catalogue
- communication
- error-console
- journal
- notifications
- stock_handpick
- tournee
- users

