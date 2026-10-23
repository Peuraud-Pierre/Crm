# Upload de Vidéos par Chunks - Documentation Technique

Ce système permet d'uploader de grosses vidéos en contournant la limitation de 100MB de Cloudflare.

## ✅ Déjà intégré dans le Drive

Le système est **déjà opérationnel** dans le composant [`Drive.tsx`](./routes/Drive.tsx). Il détecte automatiquement les erreurs 413 et bascule vers l'upload par chunks.

**Vous n'avez rien à faire !** L'upload fonctionne automatiquement avec :
- Barre de progression visible
- Détection auto du mode chunked pour les gros fichiers
- Affichage du nombre de chunks en cours

## 🎯 Fonctionnalités

- ✅ **Fallback automatique** en cas d'erreur 413 (Payload Too Large)
- ✅ **Barre de progression** intégrée dans le Drive
- ✅ **Upload par chunks transparent** pour l'utilisateur
- ✅ **Vérification d'intégrité** avec hash SHA-256
- ✅ **Support images et vidéos**

## 🔄 Comment ça fonctionne

### Upload Normal (< 100MB)
```
1. Utilisateur sélectionne un fichier
2. Upload direct vers /api/gallery/upload-video
3. Affichage dans le Drive
```

### Upload par Chunks (> 100MB ou erreur 413)
```
1. Tentative d'upload direct
2. Erreur 413 détectée → Basculement automatique
3. Division en chunks de 5MB
4. Upload progressif avec barre de progression
5. Assemblage côté serveur
6. Affichage dans le Drive
```

Le basculement est **100% transparent** pour l'utilisateur.

## 🔧 Endpoints API requis

Votre backend doit exposer ces 4 endpoints :

### 1. Upload normal (fallback)
```
POST /api/gallery/upload-video
Headers: Authorization: Bearer <token>
Body: FormData { file }
Response: { video: { id, url, title, sizeMB, type } }
```

### 2. Initier un upload par chunks
```
POST /api/gallery/chunked/initiate
Headers: Authorization, Content-Type: application/json
Body: { filename: string, total_chunks: number, total_size: number }
Response: { upload_id: string, filename, total_chunks, total_size }
```

### 3. Uploader un chunk
```
POST /api/gallery/chunked/upload
Headers: Authorization
Body: FormData {
  upload_id: string,
  chunk_index: number,
  chunk_hash: string,
  chunk: Blob
}
Response: { message: "success", chunk_index, upload_id }
```

### 4. Finaliser l'upload
```
POST /api/gallery/chunked/finalize
Headers: Authorization, Content-Type: application/json
Body: { upload_id: string }
Response: {
  message: "success",
  video: { id, url, title, sizeMB, type }
}
```

### 5. Annuler (optionnel)
```
DELETE /api/gallery/chunked/cancel/:uploadId
Headers: Authorization
Response: { message: "cancelled" }
```

## 📊 Architecture du code

```
src/features/drive/
├── utils/
│   └── ChunkedUploader.ts       # Client d'upload par chunks
├── hooks/
│   ├── useDrive.ts                 # Détection auto 413 + fallback
│   └── useVideoUpload.ts             # Hook avec state management
├── routes/
│   └── Drive.tsx                   # ✅ UI avec barre de progression
└── CHUNKED_UPLOAD.md                 # Cette doc
```

## 🧪 Tester le système

### 1. Créer un gros fichier de test
```bash
# Créer un fichier de 150MB
dd if=/dev/zero of=test-150mb.mp4 bs=1M count=150
```

### 2. Uploader via l'UI
- Ouvrir le Drive
- Cliquer sur "Depuis le Drive"
- Sélectionner le fichier de 150MB
- Observer la barre de progression avec les chunks

### 3. Vérifier les logs
Vous verrez dans la console :
```
⚠️ Fichier trop volumineux (150.00MB), basculement vers upload par chunks...
📦 Fichier: test-150mb.mp4 (150.00MB)
📊 Nombre de chunks: 30
✅ Session créée: upload-id-xyz
📤 Chunk 1/30 uploadé (3%)
📤 Chunk 2/30 uploadé (6%)
...
✅ Upload terminé
```

## ⚙️ Configuration

### Modifier la taille des chunks

Dans [`ChunkedUploader.ts`](./utils/ChunkedUploader.ts#L32) :

```typescript
constructor(apiBaseUrl: string, authToken: string, chunkSize = 5 * 1024 * 1024)
```

Valeurs recommandées :
- **5MB** (défaut) : Bon pour la plupart des cas
- **10MB** : Connexions rapides
- **2-3MB** : Connexions lentes

## 🐛 Résolution de problèmes

### ❌ "Unauthorized"
→ Vérifier que le token JWT est valide

### ❌ "Failed to initiate upload"
→ Vérifier que l'endpoint `/chunked/initiate` existe

### ❌ Upload bloqué à X%
→ Vérifier les logs réseau (DevTools > Network)

### ❌ "Upload not found" lors de finalize
→ Session expirée côté serveur (augmenter le timeout)

## 📝 Utilisation programmatique (optionnel)

Si vous voulez utiliser le système en dehors de le Drive :

```typescript
import { useDrive } from "@/features/drive/hooks/useDrive"

function MyComponent() {
  const { uploadFiles } = useDrive(apiUrl)

  const handleUpload = async (files: FileList) => {
    const results = await uploadFiles(files, (progress) => {
      console.log(`${progress.percent}% - Chunk ${progress.uploadedChunks}/${progress.totalChunks}`)
    })
    return results
  }
}
```

## ✅ Checklist backend

- [ ] Endpoint `POST /api/gallery/chunked/initiate` créé
- [ ] Endpoint `POST /api/gallery/chunked/upload` créé
- [ ] Endpoint `POST /api/gallery/chunked/finalize` créé
- [ ] Stockage temporaire des chunks (filesystem ou S3)
- [ ] Vérification du hash SHA-256 de chaque chunk
- [ ] Assemblage des chunks dans le bon ordre
- [ ] Nettoyage des chunks temporaires après assemblage
- [ ] Timeout des sessions (ex: 30 minutes)
- [ ] Gestion des uploads concurrents
- [ ] Tests avec fichiers > 100MB

## 📚 Ressources

- [Cloudflare Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Tests unitaires](./utils/ChunkedUploader.test.ts)
