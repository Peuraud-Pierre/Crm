/**
 * Script de diagnostic des bundles de clés cryptées
 *
 * Pour l'utiliser :
 * 1. Copier ce code dans la console du navigateur
 * 2. Exécuter : await diagnoseBundles()
 * 3. Voir le rapport détaillé dans la console
 */

import { diagnoseBundleStatus } from "./bundleValidation"
import { readEncryptedBundle } from "./storage"
import { cryptoLogger } from "@/features/messages/core/logger"

export async function diagnoseBundles(userId: string) {
    cryptoLogger.log("🔍 === DIAGNOSTIC DES BUNDLES DE CLÉS ===\n")

    try {
        // 1. Vérifier le localStorage
        const localBundle = readEncryptedBundle()
        cryptoLogger.log("📦 Bundle local:")
        if (localBundle) {
            cryptoLogger.log("  ✅ Existe")
            try {
                const parsed = JSON.parse(localBundle)
                const hasRequiredFields = !!(
                    parsed?.salt_b64 &&
                    parsed?.iv_b64 &&
                    parsed?.ciphertext_b64
                )
                if (hasRequiredFields) {
                    cryptoLogger.log("  ✅ Format valide")
                    cryptoLogger.log(
                        `  📏 Taille: ${localBundle.length} caractères`
                    )
                } else {
                    cryptoLogger.log("  ❌ Format invalide - champs manquants")
                    cryptoLogger.log("  📄 Contenu:", parsed)
                }
            } catch {
                cryptoLogger.log("  ❌ JSON corrompu - impossible de parser")
                cryptoLogger.log(
                    "  📄 Contenu brut:",
                    localBundle.substring(0, 100) + "..."
                )
            }
        } else {
            cryptoLogger.log("  ❌ N'existe pas")
        }

        // 2. Vérifier avec la fonction de diagnostic
        cryptoLogger.log("\n🌐 Vérification cloud:")
        const status = await diagnoseBundleStatus(userId)

        cryptoLogger.log("  Local:")
        cryptoLogger.log(`    - Existe: ${status.local.exists ? "✅" : "❌"}`)
        cryptoLogger.log(`    - Valide: ${status.local.valid ? "✅" : "❌"}`)

        cryptoLogger.log("  Distant:")
        cryptoLogger.log(`    - Existe: ${status.remote.exists ? "✅" : "❌"}`)
        cryptoLogger.log(`    - Valide: ${status.remote.valid ? "✅" : "❌"}`)

        cryptoLogger.log(`  Synchronisé: ${status.synchronized ? "✅" : "❌"}`)

        // 3. Recommandations
        cryptoLogger.log("\n💡 RECOMMANDATIONS:\n")

        if (!status.local.exists && !status.remote.exists) {
            cryptoLogger.log(
                "⚠️  Aucun bundle trouvé - un nouveau sera créé au prochain unlock"
            )
        } else if (status.local.valid && status.synchronized) {
            cryptoLogger.log(
                "✅ Tout est OK - bundles local et distant synchronisés"
            )
        } else if (!status.local.valid && status.remote.valid) {
            cryptoLogger.log("🔄 Bundle local corrompu mais distant OK")
            cryptoLogger.log(
                "   → Au prochain unlock, le bundle distant sera utilisé automatiquement"
            )
        } else if (
            status.local.valid &&
            !status.remote.valid &&
            status.remote.exists
        ) {
            cryptoLogger.log("⚠️  Bundle distant corrompu mais local OK")
            cryptoLogger.log(
                "   → Utilise 'forceBundleResync()' pour resynchroniser depuis le local"
            )
        } else if (!status.local.valid && !status.remote.valid) {
            cryptoLogger.log("❌ Les deux bundles sont corrompus")
            cryptoLogger.log(
                "   → Utilise 'purgeRemoteBundle()' puis recrée un nouveau bundle"
            )
        } else if (
            !status.synchronized &&
            status.local.valid &&
            status.remote.valid
        ) {
            cryptoLogger.log("⚠️  Les bundles sont différents (désynchronisés)")
            cryptoLogger.log(
                "   → Utilise 'forceBundleResync()' pour resynchroniser"
            )
        }

        cryptoLogger.log("\n🔍 === FIN DU DIAGNOSTIC ===")

        return status
    } catch (error) {
        console.error("❌ Erreur lors du diagnostic:", error)
        throw error
    }
}

/**
 * Version copier-coller pour la console du navigateur
 * (n'a pas besoin d'imports)
 */
export const browserDiagnosticScript = `
async function diagnoseBundles(userId) {
    cryptoLogger.log("🔍 === DIAGNOSTIC DES BUNDLES DE CLÉS ===\\n")

    // 1. Check localStorage
    const localBundle = localStorage.getItem('cryptedmessage:keybundle:v1')
    cryptoLogger.log("📦 Bundle local:")
    if (localBundle) {
        cryptoLogger.log("  ✅ Existe")
        try {
            const parsed = JSON.parse(localBundle)
            const hasFields = !!(parsed?.salt_b64 && parsed?.iv_b64 && parsed?.ciphertext_b64)
            cryptoLogger.log(hasFields ? "  ✅ Format valide" : "  ❌ Format invalide")
            cryptoLogger.log("  📏 Taille:", localBundle.length, "caractères")
        } catch(e) {
            cryptoLogger.log("  ❌ JSON corrompu")
        }
    } else {
        cryptoLogger.log("  ❌ N'existe pas")
    }

    // 2. Check remote
    cryptoLogger.log("\\n🌐 Vérification cloud...")
    const supabase = window.supabase // Assurez-vous que supabase est accessible
    const { data, error } = await supabase
        .from('cryptedmessage_keybundles')
        .select('bundle')
        .eq('user_id', userId)
        .maybeSingle()

    if (data?.bundle) {
        cryptoLogger.log("  ✅ Bundle distant existe")
        const hasFields = !!(data.bundle?.salt_b64 && data.bundle?.iv_b64 && data.bundle?.ciphertext_b64)
        cryptoLogger.log(hasFields ? "  ✅ Format valide" : "  ❌ Format invalide")
    } else {
        cryptoLogger.log("  ❌ Pas de bundle distant")
    }

    cryptoLogger.log("\\n🔍 === FIN DU DIAGNOSTIC ===")
}

// Utilisation: await diagnoseBundles('your-user-id')
`
