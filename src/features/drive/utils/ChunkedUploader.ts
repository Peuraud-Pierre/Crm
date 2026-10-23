import type { DriveItemType } from "../types";

/**
 * Client TypeScript pour uploader de grosses vidéos par chunks
 * Permet de contourner la limitation de 100MB de Cloudflare
 */

export interface UploadSession {
  upload_id: string;
  filename: string;
  total_chunks: number;
  total_size: number;
}

export interface ChunkUploadResponse {
  message: string;
  chunk_index: number;
  upload_id: string;
}

export interface UploadedFile {
  id: string;
  url: string;
  title: string;
  owner_id: string;
  createdAt: string;
  type: DriveItemType;
  mime: string;
  sizeBytes: number;
  sizeMB: string;
  isFolder?: boolean;
  parentId?: string;
}

export interface FinalizeResponse {
  message: string;
  file: UploadedFile;
  /** Alias conservé par le backend le temps de la bascule. */
  video?: UploadedFile;
}

export interface UploadProgress {
  percent: number;
  uploadedChunks: number;
  totalChunks: number;
  uploadedBytes: number;
  totalBytes: number;
}

export class ChunkedUploader {
  private apiBaseUrl: string;
  private authToken: string;
  private chunkSize: number;

  constructor(apiBaseUrl: string, authToken: string, chunkSize = 5 * 1024 * 1024) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
    this.chunkSize = chunkSize; // 5MB par défaut
  }

  /**
   * Upload un fichier en chunks, quel que soit son type.
   * @param file - Le fichier à uploader
   * @param onProgress - Callback pour suivre la progression
   * @returns Résultat de l'upload
   */
  async upload(
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FinalizeResponse> {
    try {
      // 1. Calculer le nombre de chunks
      const totalChunks = Math.ceil(file.size / this.chunkSize);
      console.log(`📦 Fichier: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      console.log(`📊 Nombre de chunks: ${totalChunks}`);

      // 2. Initier la session d'upload
      const session = await this.initiateUpload(file.name, totalChunks, file.size);
      console.log(`✅ Session créée: ${session.upload_id}`);

      // 3. Uploader chaque chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Calculer le hash MD5 du chunk pour vérifier l'intégrité
        const chunkHash = await this.calculateMD5(chunk);

        await this.uploadChunk(session.upload_id, i, chunk, chunkHash);

        const percent = Math.round(((i + 1) / totalChunks) * 100);
        console.log(`📤 Chunk ${i + 1}/${totalChunks} uploadé (${percent}%)`);

        if (onProgress) {
          onProgress({
            percent,
            uploadedChunks: i + 1,
            totalChunks,
            uploadedBytes: end,
            totalBytes: file.size,
          });
        }
      }

      // 4. Finaliser l'upload
      const result = await this.finalizeUpload(session.upload_id);
      console.log(`✅ Upload terminé:`, result);

      if (onProgress) {
        onProgress({
          percent: 100,
          uploadedChunks: totalChunks,
          totalChunks,
          uploadedBytes: file.size,
          totalBytes: file.size,
        });
      }

      return result;
    } catch (error) {
      console.error(`❌ Erreur upload:`, error);
      throw error;
    }
  }

  /**
   * Initie une session d'upload
   */
  private async initiateUpload(
    filename: string,
    totalChunks: number,
    totalSize: number
  ): Promise<UploadSession> {
    const response = await fetch(`${this.apiBaseUrl}/chunked/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        filename,
        total_chunks: totalChunks,
        total_size: totalSize,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to initiate upload' }));
      throw new Error(error.error || 'Failed to initiate upload');
    }

    return await response.json();
  }

  /**
   * Upload un chunk individuel
   */
  private async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkBlob: Blob,
    chunkHash: string
  ): Promise<ChunkUploadResponse> {
    const formData = new FormData();
    formData.append('upload_id', uploadId);
    formData.append('chunk_index', chunkIndex.toString());
    formData.append('chunk_hash', chunkHash);
    formData.append('chunk', chunkBlob);

    const response = await fetch(`${this.apiBaseUrl}/chunked/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `Failed to upload chunk ${chunkIndex}` }));
      throw new Error(error.error || `Failed to upload chunk ${chunkIndex}`);
    }

    return await response.json();
  }

  /**
   * Finalise l'upload en assemblant les chunks
   */
  private async finalizeUpload(uploadId: string): Promise<FinalizeResponse> {
    const response = await fetch(`${this.apiBaseUrl}/chunked/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        upload_id: uploadId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to finalize upload' }));
      throw new Error(error.error || 'Failed to finalize upload');
    }

    return await response.json();
  }

  /**
   * Annule un upload en cours
   */
  async cancelUpload(uploadId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.apiBaseUrl}/chunked/cancel/${uploadId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to cancel upload' }));
      throw new Error(error.error || 'Failed to cancel upload');
    }

    return await response.json();
  }

  /**
   * Calcule le hash MD5 d'un blob (pour vérifier l'intégrité)
   */
  private async calculateMD5(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer); // Utilise SHA-256 car MD5 n'est pas disponible dans Web Crypto API
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
