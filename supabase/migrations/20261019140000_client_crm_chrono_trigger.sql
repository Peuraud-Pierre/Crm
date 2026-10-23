-- Versionne le trigger du chrono de prise en charge des leads, créé hors dépôt.
-- Reprise à l'identique de la définition en base au 19/10/2026 (aucun
-- changement de comportement) : une base recréée depuis les migrations n'avait
-- sinon jamais de `prise_en_charge` renseigné, et le chrono (LiveTimer des
-- cartes Kanban / vue tableau) tournait indéfiniment.
--
-- Règle : le chrono court tant que le lead est en colonne 0 (« Nouveau lead »).
--   - sortie de la colonne 0 → prise_en_charge = NOW() (le chrono s'arrête)
--   - retour en colonne 0    → prise_en_charge = NULL (le chrono réapparaît,
--     compté depuis created_at)
--
-- Limite connue : BEFORE UPDATE seulement. Un lead INSÉRÉ directement hors
-- colonne 0 garde prise_en_charge NULL (chrono affiché) jusqu'à sa première
-- mise à jour.

CREATE OR REPLACE FUNCTION public."Chronos_trg"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$BEGIN
    IF NEW.collum = 0 THEN
        NEW.prise_en_charge := NULL;

    ELSIF NEW.collum >= 1 AND NEW.prise_en_charge IS NULL THEN
        -- NOW() renvoie la date ET l'heure (ex: 2023-10-27 14:30:05)
        NEW.prise_en_charge := NOW();
    END IF;

    RETURN NEW;
END;$function$;

DROP TRIGGER IF EXISTS "Chrono_lead" ON public.client_crm;
CREATE TRIGGER "Chrono_lead"
    BEFORE UPDATE ON public.client_crm
    FOR EACH ROW EXECUTE FUNCTION public."Chronos_trg"();
