# Changelog - Version 1.8.0 (8 Décembre 2025)

## 🔐 Authentification & Sécurité

### ✨ Nouvelle fonctionnalité : Réinitialisation de mot de passe avec MFA

-   **Ajout de la vérification MFA pour la réinitialisation de mot de passe**
    -   Nouveau composant `MfaVerificationStep` pour la saisie du code TOTP
    -   Détection automatique du statut MFA de l'utilisateur
    -   Vérification du niveau AAL (Authenticator Assurance Level)
    -   Mise à niveau de session AAL1 → AAL2 pour les utilisateurs avec MFA activé
    -   Interface utilisateur intuitive avec validation en temps réel du code à 6 chiffres

### 🔧 Correctif : Flux de réinitialisation de mot de passe

-   **Correction du gestionnaire de confirmation d'authentification**

    -   Nouvelle page `AuthConfirm` pour gérer les liens `/auth/confirm` de Supabase
    -   Vérification des tokens de récupération via `verifyOtp`
    -   Support des types `recovery` (réinitialisation) et `signup` (confirmation email)
    -   Redirection automatique vers la page de réinitialisation après validation

-   **Refonte de la page ResetPassword**

    -   Migration vers une authentification basée sur la session
    -   Suppression de la vérification des paramètres URL (`access_token`, `refresh_token`)
    -   Rendu conditionnel basé sur le statut MFA :
        -   État de chargement pendant la vérification MFA
        -   Étape de vérification MFA si nécessaire
        -   Formulaire de réinitialisation de mot de passe
        -   État de succès avec redirection

-   **Ajout de routes d'authentification**
    -   Route `/auth/confirm` accessible pour les utilisateurs authentifiés et non-authentifiés
    -   Gestion cohérente du flux d'authentification

### 🛠️ Améliorations techniques

-   Nouvelle fonction `getCurrentAAL()` dans `auth.mfa.ts` pour vérifier le niveau d'assurance
-   Gestion d'erreur améliorée avec messages utilisateur clairs
-   Support complet du flux de récupération Supabase

---

## 👥 CRM - Gestion des Clients

### ✨ Nouvelle fonctionnalité : Prise de lead

-   **Fonction `take_lead` pour assigner des clients**
    -   Permet aux utilisateurs de s'assigner un client non attribué
    -   Mise à jour automatique du champ `customer` avec l'ID de l'utilisateur
    -   Intégration dans la vue détaillée du client (`colonneg.tsx`)
    -   Bouton avec icône "main" pour une action rapide
    -   Visible uniquement si le client n'a pas encore de responsable

### 🔧 Correctif : Types de données

-   **Correction des types d'ID de produits**

    -   Migration de `string` vers `number` pour les IDs de produits
    -   Mise à jour de `delete_product` et `update_product` dans `CRMContext`
    -   Alignement avec la structure de données Supabase

-   **Correction du type d'événement RDV**
    -   Type `rdv` mis à jour de `string` vers `Event_creation`
    -   Amélioration de la sécurité des types dans la gestion des activités

---

## 🏗️ Améliorations de l'architecture

### 🔧 Refactoring : Gestion des données CRM

-   **Simplification de l'assignation des données brief**
    -   Code plus lisible et maintenable
    -   Meilleure sécurité des types dans la gestion des clients
    -   Optimisation de la gestion des activités

### 🛠️ Configuration TypeScript

-   **Définition des types pour les variables d'environnement Supabase**

    -   Ajout des types dans `vite-env.d.ts`
    -   Meilleure autocomplétion et vérification des types
    -   Support de `ImportMeta.env` pour les variables Supabase

-   **Amélioration du typage des événements calendrier**
    -   Typage explicite du paramètre `event` dans le mapping des données
    -   Réduction des erreurs potentielles de type

---

## 📝 Notes importantes

> **Utilisateurs avec MFA activé**  
> Les utilisateurs avec authentification à deux facteurs doivent avoir accès à leur application d'authentification pour réinitialiser leur mot de passe. En cas de perte d'accès à l'appareil MFA, une assistance administrateur est nécessaire.

> **Configuration email Supabase**  
> Si vous rencontrez des problèmes d'encodage dans les emails (caractères `=C3=A9`, `=3D`, etc.), mettez à jour le template d'email dans le dashboard Supabase sous **Authentication → Email Templates**.

---

## 🔄 Flux de réinitialisation de mot de passe

### Sans MFA

1. Demande de réinitialisation → Email → Clic sur le lien
2. Vérification du token → Création de session
3. Formulaire de nouveau mot de passe → Succès

### Avec MFA

1. Demande de réinitialisation → Email → Clic sur le lien
2. Vérification du token → Création de session AAL1
3. **Vérification MFA (code TOTP à 6 chiffres)**
4. Mise à niveau vers session AAL2
5. Formulaire de nouveau mot de passe → Succès
