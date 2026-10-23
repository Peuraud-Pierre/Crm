-- ============================================================
-- Mail RDV : lire la langue d'un brief doublement encodé
-- ============================================================
-- Suite de 20260915100000. En prod, les briefs des clients créés ou modifiés
-- depuis la fiche CRM sont de type jsonb 'string' (JSON.stringify côté front,
-- corrigé dans use_client.tsx) : la langue EN restait invisible et le mail de
-- confirmation partait en français. Les briefs écrits par le bridge Amelia
-- sont, eux, de vrais objets.
--
-- Pas de backfill des lignes existantes : un UPDATE massif de client_crm
-- déclencherait log_client_crm_changes sur chaque fiche. Chaque sauvegarde de
-- fiche réécrit désormais un objet ; la fonction lit les deux formes.
--
-- Même signature : CREATE OR REPLACE. Corps identique à 20260915100000, bloc
-- de décodage ajouté avant la détection de langue.
-- ============================================================

CREATE OR REPLACE FUNCTION public.post_rdv_mail(
    p_event_id uuid,
    p_motif    text DEFAULT 'confirmation'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event        record;
    v_client_mail  text;
    v_client_brief jsonb;
    v_lang         text := 'fr';
    v_payload      jsonb;
BEGIN
    SELECT id, nom, debut, client, customer, creator_id, id_client, confirmed
      INTO v_event
      FROM public."Event_calendar"
     WHERE id = p_event_id;

    -- RDV supprimé entre la mise en file et l'envoi.
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF NOT v_event.confirmed OR v_event.nom IS NOT DISTINCT FROM 'Non Disponible' THEN
        RETURN false;
    END IF;

    SELECT mail, brief INTO v_client_mail, v_client_brief
      FROM public.client_crm
     WHERE id = v_event.id_client;

    IF v_client_mail IS NULL OR length(v_client_mail) = 0 THEN
        RETURN false;
    END IF;

    -- Brief doublement encodé : le CRM (use_client.tsx) envoyait
    -- JSON.stringify(brief) dans cette colonne jsonb, qui stocke alors une
    -- CHAÎNE contenant le JSON — ->>'language' y renvoie NULL. On la décode
    -- une fois, comme detectLangue côté Go. Contenu invalide → NULL → 'fr' :
    -- la langue du mail ne doit jamais faire échouer la confirmation du RDV.
    IF jsonb_typeof(v_client_brief) = 'string' THEN
        BEGIN
            v_client_brief := (v_client_brief #>> '{}')::jsonb;
        EXCEPTION WHEN others THEN
            v_client_brief := NULL;
        END;
    END IF;

    -- Langue déduite du brief ("EN" côté fiche CRM et bridge Amelia).
    IF lower(COALESCE(NULLIF(v_client_brief->>'language', ''),
                      v_client_brief->>'langue', '')) LIKE 'en%' THEN
        v_lang := 'en';
    END IF;

    v_payload := jsonb_build_object(
        'client_email', v_client_mail,
        'client_nom',   COALESCE(v_event.client, 'Client'),
        'date_rdv',     to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
        'heure_rdv',    to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'HH24"h"MI'),
        'owner',        COALESCE(v_event.customer, v_event.creator_id),
        'langue',       v_lang,
        'type_rdv',     COALESCE(v_event.nom, 'autre'),
        'motif',        p_motif
    );

    PERFORM net.http_post(
        url     := 'https://info.nokk-project.example/no_repleid_rdv',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := v_payload
    );

    RETURN true;
END;
$$;


-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   select jsonb_typeof(brief) as type, count(*) from public.client_crm group by 1;
--   -- clients dont la langue EN n'était lisible qu'après décodage :
--   select count(*) from public.client_crm
--    where jsonb_typeof(brief) = 'string'
--      and (brief #>> '{}') ~* '"(language|langue)"\s*:\s*"en';
