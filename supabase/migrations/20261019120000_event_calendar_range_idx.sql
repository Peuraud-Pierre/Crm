-- Index pour les lectures fenêtrées de l'agenda CRM (calendarEventService).
--
-- L'agenda ne charge plus tout l'historique mais une plage sur `debut`
-- (mois affiché ± 1, ou l'année) :
--   - vues mois/semaine, tous commerciaux : WHERE debut >= … AND debut < …
--   - vues jour/année, un commercial      : WHERE customer = … AND debut …
-- et la fiche client charge les RDV d'un client : WHERE id_client = …
-- (l'index partiel event_calendar_unconfirmed_idx ne couvre que les RDV en
-- attente).
--
-- Note : sur une grosse table en production, préférer
--   CREATE INDEX CONCURRENTLY ...
-- (à exécuter hors transaction) pour éviter de verrouiller les écritures.

CREATE INDEX IF NOT EXISTS event_calendar_debut_idx
    ON public."Event_calendar" (debut);

CREATE INDEX IF NOT EXISTS event_calendar_customer_debut_idx
    ON public."Event_calendar" (customer, debut);

CREATE INDEX IF NOT EXISTS event_calendar_id_client_idx
    ON public."Event_calendar" (id_client);
