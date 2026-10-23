/**
 * Souvenirs du dernier compte connecté sur cet appareil : l'email pour
 * préremplir le formulaire, le prénom pour l'accueil (« Bonjour Ethan »).
 *
 * Commodités uniquement : tout est en try/catch (navigation privée, stockage
 * bloqué) et rien ne doit dépendre de leur présence. Rien de secret ici — le
 * mot de passe n'est jamais stocké.
 */

const LAST_EMAIL_KEY = "auth:lastEmail"
const FIRST_NAME_KEY = "auth:firstName"

function read(key: string): string {
    try {
        return window.localStorage.getItem(key) ?? ""
    } catch {
        return ""
    }
}

function write(key: string, value: string | null) {
    try {
        if (value) window.localStorage.setItem(key, value)
        else window.localStorage.removeItem(key)
    } catch {
        // Stockage indisponible : on se passe du confort.
    }
}

export const readLastEmail = () => read(LAST_EMAIL_KEY)
export const writeLastEmail = (email: string) => write(LAST_EMAIL_KEY, email)

export const readFirstName = () => read(FIRST_NAME_KEY)

/** Mémorise le prénom tiré du nom complet du profil (« Ethan Martin » → « Ethan »). */
export function rememberFirstName(fullName: string | undefined) {
    const first = fullName?.trim().split(/\s+/)[0]
    if (first) write(FIRST_NAME_KEY, first)
}

/** « Utiliser un autre compte » : on oublie qui était là. */
export function forgetRememberedAccount() {
    write(LAST_EMAIL_KEY, null)
    write(FIRST_NAME_KEY, null)
}

/** Salutation selon l'heure locale : « Bonsoir » de 18 h à 5 h. */
export function greeting(date = new Date()): string {
    const h = date.getHours()
    return h >= 18 || h < 5 ? "Bonsoir" : "Bonjour"
}
