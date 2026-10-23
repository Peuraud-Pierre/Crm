# Sidebar — Documentation technique

## Architecture

La sidebar repose sur trois couches séparées :

```
menuItems.ts          → Source de vérité (routes, permissions, icônes)
      ↓
AuthProvider          → Filtre allowedRoutes selon les permissions Supabase
      ↓
Sidebar.tsx           → Construit la structure et rend les items
      ↓
CollapsibleSection    → Affiche les groupes et catégories pliables
```

La sidebar fonctionne en mode **drawer overlay** sur tous les formats. Elle s'ouvre depuis le bouton hamburger dans le header (`MainLayout.tsx`) et se ferme via l'overlay, via `onNavigate` (clic sur un lien), ou via la croix.

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/shared/components/layout/menuItems.ts` | Configuration de toutes les routes |
| `src/shared/components/layout/Sidebar.tsx` | Composant principal |
| `src/shared/components/sidebar/CollapsibleSection.tsx` | Section pliable (groupe / catégorie) |
| `src/shared/components/layout/MainLayout.tsx` | Layout qui ouvre/ferme la sidebar |
| `src/shared/components/layout/Header.tsx` | Bouton hamburger + titre de page |
| `src/shared/components/misc/Permission.tsx` | Filtre les routes par permission Supabase |

---

## Structure d'un item (`MenuItem`)

```ts
interface MenuItem {
    title: string           // Identifiant unique, snake_case
    displayName: string     // Libellé affiché (sidebar + titre du header)
    icon: ComponentType     // Icône Lucide React
    href: string            // Route exacte (ex: "/crm")
    permissionCode: string  // Code vérifié contre les permissions Supabase
    category: MenuCategory  // Null = section principale, sinon catégorie collapsible
    group?: string          // Sous-groupe dans la section principale (collapsible)
    hideFromSidebar?: boolean // N'apparaît pas dans le menu (ex: /profile)
    icon_main?: ComponentType // Icône représentant le groupe/catégorie (header du collapsible)
}
```

---

## Types de sections

### 1. Item simple (section principale)

`category: null`, pas de `group`. S'affiche directement dans la nav, sans regroupement.

```
┌─────────────────┐
│ 🏠 Accueil      │
│ ✉️ Messages      │
│ 📋 Projets      │
└─────────────────┘
```

### 2. Groupe (section principale pliable)

`category: null` + `group: "Nom du groupe"`. Plusieurs items partagent le même `group`, ils s'affichent sous un bouton pliable dans la section principale. Tous les items du groupe doivent avoir `icon_main` défini.

```
┌─────────────────────┐
│ ✨ Génération ▶     │ ← CollapsibleSection
│   ├ 📷 Créer visuel │
│   ├ 📃 Mes généra.. │
│   └ 🛡 Gestion      │
└─────────────────────┘
```

### 3. Catégorie (section catégorie pliable)

`category: "Commercial"` (ou Admin, Entrepot, Comptabilité). Regroupe les items par domaine métier dans leur propre section pliable. Tous les items d'une catégorie doivent partager le même `icon_main`.

```
┌─────────────────────┐
│ 🤝 Commercial ▶     │ ← CollapsibleSection
│   ├ 📊 CRM          │
│   ├ 📈 Analytics    │
│   └ 📦 Catalogue    │
└─────────────────────┘
```

---

## Cas d'usage — recettes

### Ajouter un item simple

Ajouter l'entrée dans `menuItems.ts`, créer la permission côté Supabase.

```ts
// menuItems.ts
import { Bell } from "lucide-react"

{
    title: "notifications",
    displayName: "Notifications",
    icon: Bell,
    href: "/notifications",
    permissionCode: "notifications.view",
    category: null,
},
```

Le titre du header se dérive automatiquement de `displayName`. Aucun autre fichier à modifier.

---

### Ajouter un item dans un groupe existant

Reprendre le même `group` et le même `icon_main` que les autres items du groupe.

```ts
// Exemple : ajouter "Historique" dans "Génération de contenu"
import { History } from "lucide-react"

{
    title: "contenthistory",
    displayName: "Historique",
    icon: History,
    href: "/contenthistory",
    permissionCode: "content.view",
    category: null,
    group: "Génération de contenu",
    icon_main: Sparkles,  // ← même icon_main que les autres items du groupe
},
```

---

### Créer un nouveau groupe

Donner le même nom de `group` à tous les items concernés et définir `icon_main` sur chacun.

```ts
import { Truck, MapPin } from "lucide-react"
import { Route } from "lucide-react" // icône du groupe

{
    title: "livraisons",
    displayName: "Livraisons",
    icon: Truck,
    href: "/livraisons",
    permissionCode: "livraisons.view",
    category: null,
    group: "Logistique",
    icon_main: Route,
},
{
    title: "suivi",
    displayName: "Suivi colis",
    icon: MapPin,
    href: "/suivi",
    permissionCode: "suivi.view",
    category: null,
    group: "Logistique",
    icon_main: Route,
},
```

---

### Ajouter un item dans une catégorie existante

Utiliser la catégorie cible et le même `icon_main` que les autres items de cette catégorie.

```ts
// Catégories disponibles : "Admin" | "Commercial" | "Entrepot" | "Comptabilité"
import { BarChart2 } from "lucide-react"

{
    title: "rapports_ventes",
    displayName: "Rapports de ventes",
    icon: BarChart2,
    href: "/rapports-ventes",
    permissionCode: "rapports.view",
    category: "Commercial",
    icon_main: Handshake,  // ← icon_main de la catégorie Commercial
},
```

**Règle :** tous les items d'une même catégorie partagent le même `icon_main`. C'est cette valeur qui devient l'icône du bouton collapsible de la catégorie.

| Catégorie | `icon_main` |
|---|---|
| `"Admin"` | `ShieldCheck` |
| `"Commercial"` | `Handshake` |
| `"Entrepot"` | `Container` |
| `"Comptabilité"` | `HandCoins` |

---

### Créer une nouvelle catégorie

**Étape 1** — Déclarer la catégorie dans le type `MenuCategory` :

```ts
// menuItems.ts
export type MenuCategory =
    | "Admin"
    | "Commercial"
    | "Entrepot"
    | "Comptabilité"
    | "RH"        // ← nouveau
    | null
```

**Étape 2** — Choisir une icône pour la catégorie et ajouter les items :

```ts
import { UserRound } from "lucide-react" // icon_main de la catégorie RH

{
    title: "conges",
    displayName: "Congés",
    icon: Calendar,
    href: "/conges",
    permissionCode: "conges.view",
    category: "RH",
    icon_main: UserRound,
},
{
    title: "employes",
    displayName: "Employés",
    icon: Users,
    href: "/employes",
    permissionCode: "employes.view",
    category: "RH",
    icon_main: UserRound,
},
```

La catégorie apparaît automatiquement dans la sidebar dans l'ordre où ses items sont déclarés dans le tableau.

---

### Ajouter une route sans entrée sidebar

Utiliser `hideFromSidebar: true`. L'item reste dans `menuItems` (le header peut en dériver le titre) mais n'apparaît pas dans le menu.

```ts
{
    title: "settings",
    displayName: "Paramètres",
    icon: Settings,
    href: "/settings",
    permissionCode: "settings.view",
    category: null,
    hideFromSidebar: true,
},
```

---

## Système de permissions

Chaque item a un `permissionCode`. Au login, `AuthProvider` appelle `fetchPermissions(userId)` qui exécute la fonction Supabase `get_user_permissions`. Les routes dont le `permissionCode` n'est pas dans le résultat sont exclues de `allowedRoutes` et donc invisibles dans la sidebar.

```
menuItems (tous les items)
       ↓ filtrage par permissionCode
allowedRoutes (items autorisés pour cet utilisateur)
       ↓
Sidebar → ne rend que allowedRoutes
```

Pour qu'un item soit visible, deux conditions sont nécessaires :
1. Le `permissionCode` est accordé à l'utilisateur dans Supabase
2. `hideFromSidebar` n'est pas `true`

---

## Titre du header

Le titre de la page dans le header (`Header.tsx`) est dérivé automatiquement du `displayName` de l'item correspondant au `pathname` courant :

```ts
// MainLayout.tsx
const title = menuItems.find((item) => item.href === pathname)?.displayName ?? ""
```

**Conséquence :** si une page n'est pas dans `menuItems`, son titre sera vide dans le header. Deux solutions dans ce cas :
- Ajouter l'item avec `hideFromSidebar: true`
- Gérer le titre directement dans le composant de la page

---

## Ordre d'affichage

L'ordre des items dans la sidebar suit l'ordre de déclaration dans le tableau `menuItems`. Les items `category: null` apparaissent en premier (section principale), puis les catégories dans l'ordre où leur premier item apparaît dans le tableau.

Pour contrôler l'ordre, modifier la position des items dans `menuItems.ts`.

---

## Comportement de la CollapsibleSection

- **Auto-ouverture :** si l'utilisateur navigue vers une page à l'intérieur d'un groupe/catégorie fermé, la section s'ouvre automatiquement.
- **Fermeture manuelle :** l'utilisateur peut refermer une section ouverte en cliquant sur son header.
- **Fermeture du drawer :** naviguer vers n'importe quel item ferme le drawer (via `onNavigate`).

---

## Checklist lors de l'ajout d'un item

- [ ] `title` unique en snake_case
- [ ] `displayName` en français, cohérent avec le reste du menu
- [ ] Icône Lucide React importée dans `menuItems.ts`
- [ ] `permissionCode` créé/attribué dans Supabase
- [ ] Route déclarée dans le router (`src/app/routes/`)
- [ ] Si dans un groupe ou une catégorie : `icon_main` identique aux autres items du groupe/catégorie
- [ ] Si `hideFromSidebar: true` : vérifier que le titre du header s'affiche correctement
