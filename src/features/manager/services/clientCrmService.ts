// Couche service de la feature manager — échantillon client_crm
// (docs/Architecture_Feature.pdf §5). Wrapper nommé, strictement
// mécanique, autour de la lecture d'échantillon de la table `client_crm`
// utilisée par la console d'erreurs (CRMLogsPanel).
import { supabase } from "@/integrations/supabase/client"

export function fetchClientSamplePool(limit: number) {
    return supabase
        .from("client_crm")
        .select("id, nom, societe, telephone, mail, localisation, collum")
        .limit(limit)
}
