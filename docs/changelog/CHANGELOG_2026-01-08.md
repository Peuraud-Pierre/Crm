# Changelog - 8 Janvier 2026

---

## ✨ AJOUTS

### 👥 CRM - Navigation & Sélection de clients

-   **Navigation clavier + boutons de navigation**
    -   Sélection de clients via boutons (précédent/suivant) dans la sidebar
    -   Navigation au clavier pour accélérer la sélection
    -   Ordonnancement linéaire en colonnes pour une navigation plus prévisible

### 🔔 Notifications

-   **Tout marquer comme lu**
    -   Ajout d’une action “mark all as read”
    -   Amélioration du traitement des notifications

---

## 📝 MODIFICATIONS

### 📅 CRM - Calendrier / Événements

-   **Optimistic updates + synchronisation temps réel**
    -   Création d’événements avec mise à jour optimiste (UI plus réactive)
    -   Récupération des données d’événements complètes avec profils clients
    -   Optimisation de la logique de création/fetch côté hook

### 👥 CRM - Gestion des clients

-   **Optimistic updates + real-time**
    -   Gestion des changements en temps réel
    -   Amélioration du fetch pour récupérer les détails clients

### ✅ Tâches

-   **Optimisation des hooks & structure de données**
    -   Mises à jour optimistes et support des changements temps réel
    -   Amélioration des références client dans la structure des tâches

### 🧱 TypeScript & Qualité

-   **Type safety renforcée**

    -   Améliorations de typage dans `useUnreadCounts`
    -   Ajustements de configuration `tsconfig`

-   **Refactors UI / Hooks**
    -   Simplification du rendu des notifications (NotificationCenter)
    -   `useKPIs` : lisibilité et gestion d’erreurs améliorées
    -   `useRoles` / `useServices` : `useCallback` + `useMemo` pour réduire les re-renders

---

## 🔧 FIXES

-   **EditDialog**
    -   Correction du comportement/affichage du dialogue d’édition
