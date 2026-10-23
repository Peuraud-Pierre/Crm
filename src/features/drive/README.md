# Drive

Stockage de fichiers **de tout type**, partagé entre utilisateurs.

Anciennement « Galerie » : la feature était limitée aux images JPEG/PNG et aux
vidéos MP4. Elle accepte désormais n'importe quel MIME.

## Backend

Le Drive parle à une API HTTP dédiée (`cypher_go`), pas directement à Supabase —
`services/driveService.ts` n'utilise Supabase que pour récupérer le token de
session.

| Endpoint | Rôle |
|---|---|
| `POST /api/gallery/upload-file` | Upload direct, tout type de fichier |
| `POST /api/gallery/upload` | *Historique* — images uniquement |
| `POST /api/gallery/upload-video` | *Historique* — vidéos uniquement |
| `POST /api/gallery/list` | Contenu d'un dossier + fil d'Ariane |
| `POST /api/gallery/folders` | Création d'un dossier |
| `POST /api/gallery/rename` | Renommage (fichier ou dossier) |
| `POST /api/gallery/move` | Déplacement vers un dossier |
| `POST /api/gallery/trash` | Contenu de la corbeille |
| `POST /api/gallery/restore` | Sortie de corbeille |
| `POST /api/gallery/purge` | Suppression définitive (corps vide = tout vider) |
| `POST /api/gallery/get` | *Historique* — racine à plat, tableau brut |
| `DELETE /api/gallery/delete/:id` | Suppression |
| `POST /api/gallery/share` / `unshare` | Permissions |
| `POST /api/gallery/chunked/*` | Upload par chunks (voir `CHUNKED_UPLOAD.md`) |

Le préfixe d'URL reste `/api/gallery` côté serveur : le renommer imposerait un
déploiement back et front simultané pour un gain cosmétique.

## Upload

Un seul chemin dans `hooks/useDrive.ts` : envoi direct, avec bascule en chunks
dans les trois cas où il ne passe pas.

```
fichier > 95 Mo ─────────────┐
réponse 413 (Cloudflare) ────┼──> upload par chunks de 5 Mo
erreur réseau (TypeError) ───┘
```

Le seuil de 95 Mo vient de la limite de payload de Cloudflare. Le découpage
n'est plus réservé aux vidéos : un PDF de 200 Mo se heurte à la même limite.

## Sécurité du serving

Le backend accepte tout type de fichier, donc `GetFile` :

- envoie **toujours** `X-Content-Type-Options: nosniff` ;
- ne sert `inline` qu'une whitelist (images, vidéo, audio, PDF) et met tout le
  reste en `attachment`.

Sans ces deux en-têtes, un `.html` ou un `.svg` uploadé serait interprété par le
navigateur sur le domaine de l'API — XSS stocké. Ne pas les retirer.

Les JPEG/PNG sont par ailleurs re-encodés à l'upload : décoder puis ré-encoder
ne conserve que du pixel et détruit tout payload caché dans les métadonnées.

## Arborescence

Les dossiers vivent dans `gallery_pictures` avec `is_folder = true`, pas dans
une table séparée : `parent_id` pointe uniformément vers un dossier, et les
dossiers héritent du partage existant (`gallery_permissions.picture_id`) sans
une ligne de code. Un dossier n'a ni `filename` ni `url` — c'est aussi ce qui
empêche un jeton de fichier de résoudre vers un dossier (`filename = NULL` est
toujours faux en SQL).

Le dossier courant vit dans l'URL (`/drive/:folderId?`, cf. `docs/ROUTING.md`) :
deep-link, retour arrière et partage de lien fonctionnent sans état à
synchroniser.

Deux gardes côté service, tous deux **avant** toute écriture :

- **Propriété** — lister, déplacer vers, ou uploader dans un dossier exige d'en
  être propriétaire. Sans quoi un identifiant deviné exposerait le contenu
  d'autrui.
- **Cycle** — déplacer un dossier sous l'un de ses propres descendants
  détacherait la branche de l'arbre, la rendant invisible et non supprimable.
  `IsDescendant` (CTE récursive) couvre aussi le cas « dans lui-même ».

Supprimer un dossier emporte son contenu.

## Corbeille

Supprimer est réversible : la ligne est marquée `deleted_at`, **le fichier
reste sur le disque**. Seule la purge détruit, et elle efface le disque *avant*
la base — l'ordre inverse laisserait, en cas d'interruption, des fichiers que
plus aucune ligne ne référence : invisibles et impossibles à nettoyer.

Un `store.Remove` remis dans le chemin de suppression casserait la corbeille ;
`TestDeleteItemsKeepsFilesOnDisk` est là pour le détecter.

Restaurer un dossier remonte la descendance supprimée **au même instant**, donc
par la même opération — un enfant jeté séparément auparavant reste au fond. Un
élément dont le parent est resté dans la corbeille revient à la racine plutôt
que dans un dossier invisible.

La corbeille ne se purge pas toute seule : rien ne la vide automatiquement au
bout de N jours, c'est à l'utilisateur de le faire depuis `/drive/corbeille`.

## Glisser-déposer

Deux gestes cohabitent sur la même zone, distingués par `dataTransfer.types` :

| Type annoncé | Geste | Effet |
|---|---|---|
| `application/x-drive-item-ids` | Interne | Déplacement vers un dossier ou un maillon du fil d'Ariane |
| `Files` | Externe | Envoi dans le dossier courant |

Sans cette distinction, glisser une carte d'un dossier à l'autre déclencherait
un envoi de fichiers. Le comportement vit dans `hooks/useDriveDrag.ts`, partagé
par la vue grille et la vue liste — deux implémentations divergeraient à la
première correction.

## Vues

Grille ou liste, au choix, mémorisé dans `localStorage` (`drive:view`) avec
repli sur la grille si le stockage est indisponible. Le tri
(`utils/sortItems.ts`) garde toujours les dossiers en tête : c'est la
convention des explorateurs de fichiers, et trier un dossier par taille n'a de
toute façon pas de sens.

## Métadonnées

`mime` et `sizeBytes` viennent de la migration `005_drive_file_metadata.sql`,
`isFolder` et `parentId` de la `006_drive_folders.sql`, `deletedAt` de la
`007_drive_trash.sql` (dépôt `cypher_go`). Les entrées antérieures ont un `mime` rétro-déduit et un
`sizeBytes` à **0**, qui signifie « taille inconnue » — `formatBytes` renvoie
`null` dans ce cas.
