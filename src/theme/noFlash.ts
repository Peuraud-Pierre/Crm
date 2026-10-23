/**
 * Source de vérité du script anti-FOUC (flash of unstyled content), injecté
 * tel quel dans <head> via `html.tags` de rsbuild.config.ts (import direct
 * de `NO_FLASH_SCRIPT` — rsbuild.config.ts tourne côté Node/CLI, pas dans le
 * bundle navigateur, donc cet import ne passe par aucun bundler applicatif).
 *
 * Ce fichier n'est PAS importé par l'app cliente elle-même : le script doit
 * rester du JS vanilla sans dépendance (pas de JSX/React/imports src/*),
 * car il s'exécute avant tout chargement de bundle, directement inline dans
 * le HTML généré.
 *
 * La logique de résolution DOIT rester alignée valeur-pour-valeur avec la
 * config next-themes de src/app/providers/ThemeProvider.tsx (storageKey
 * "darkMode", enableSystem, defaultTheme="system") pour que next-themes ne
 * corrige pas la classe posée ici au montage (voir docs/DESIGN_SYSTEM.md
 * § Theming).
 */
export const NO_FLASH_SCRIPT = `(function () {
  try {
    var KEY = "darkMode";
    var v = localStorage.getItem(KEY);
    var isDark;
    if (v === "dark" || v === "true") {
      isDark = true;
    } else if (v === "light" || v === "false") {
      isDark = false;
    } else {
      // null, "system", ou valeur inconnue -> préférence OS,
      // aligné sur next-themes (enableSystem + defaultTheme="system").
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // Fail open vers light (état par défaut sans classe) — ne jamais bloquer le paint.
  }
})();`
