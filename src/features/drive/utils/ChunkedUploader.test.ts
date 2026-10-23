/**
 * Tests unitaires pour ChunkedUploader
 */

import { describe, it, expect, rstest, beforeEach, afterEach } from "@rstest/core"
import { ChunkedUploader } from "./ChunkedUploader"
import type { UploadProgress } from "./ChunkedUploader"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs(
    "❌ Erreur upload",
    "📦 Fichier:",
    "📊 Nombre de chunks:",
    "✅ Session créée:",
    "📤 Chunk",
    "✅ Upload terminé:"
)

// Mock de fetch
global.fetch = rstest.fn() as unknown as typeof fetch

// crypto.subtle est PARTAGÉ entre fichiers de test dans un même worker
// (rstest.config.ts: isolate:false). Le mock de digest est donc installé dans
// beforeEach et l'implémentation d'origine restaurée dans afterEach : sinon ce
// mock fuite vers les autres suites (ex: messages/keyDerivation qui hashe via
// subtle.digest) et les casse. La restauration est symétrique à l'install.
const originalDigest = global.crypto.subtle.digest
const mockDigest = rstest.fn()

function setDigest(value: typeof originalDigest) {
    Object.defineProperty(global.crypto.subtle, "digest", {
        value,
        writable: true,
        configurable: true,
    })
}

// Mock de Blob.arrayBuffer
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = rstest.fn(function(this: Blob) {
        return Promise.resolve(new ArrayBuffer(this.size))
    })
}

describe("ChunkedUploader", () => {
    let uploader: ChunkedUploader
    const mockApiUrl = "https://api.test.com"
    const mockToken = "mock-jwt-token"

    beforeEach(() => {
        uploader = new ChunkedUploader(
            mockApiUrl,
            mockToken,
            5 * 1024 * 1024
        )
        rstest.clearAllMocks()
        // (Ré)installe le mock digest pour ce test. mockResolvedValue est
        // re-appliqué car restoreAllMocks (afterEach) vide l'implémentation.
        mockDigest.mockResolvedValue(new ArrayBuffer(32))
        setDigest(mockDigest as unknown as typeof originalDigest)
    })

    afterEach(() => {
        rstest.restoreAllMocks()
        // Rend crypto.subtle.digest d'origine aux autres suites du worker.
        setDigest(originalDigest)
    })

    describe("Constructor", () => {
        it("devrait initialiser avec les paramètres par défaut", () => {
            const defaultUploader = new ChunkedUploader(
                mockApiUrl,
                mockToken
            )
            expect(defaultUploader).toBeDefined()
        })

        it("devrait accepter une taille de chunk personnalisée", () => {
            const customUploader = new ChunkedUploader(
                mockApiUrl,
                mockToken,
                10 * 1024 * 1024
            )
            expect(customUploader).toBeDefined()
        })
    })

    describe("upload", () => {
        it("devrait uploader un petit fichier (1 chunk)", async () => {
            const mockFile = new File(["a".repeat(1024)], "test.mp4", {
                type: "video/mp4",
            })

            const mockInitiateResponse = {
                upload_id: "test-upload-id",
                filename: "test.mp4",
                total_chunks: 1,
                total_size: 1024,
            }

            const mockFinalizeResponse = {
                message: "success",
                file: {
                    id: "video-123",
                    url: "https://cdn.test.com/video-123.mp4",
                    title: "test.mp4",
                    owner_id: "user-1",
                    createdAt: "2026-01-01T00:00:00Z",
                    type: "video" as const,
                    mime: "video/mp4",
                    sizeBytes: 1024,
                    sizeMB: "0.00",
                },
            }

            // Mock des appels fetch
            rstest
                .mocked(fetch)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockInitiateResponse,
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ message: "chunk uploaded" }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockFinalizeResponse,
                } as Response)

            const progressCallback = rstest.fn()
            const result = await uploader.upload(
                mockFile,
                progressCallback
            )

            // Vérifications
            expect(result).toEqual(mockFinalizeResponse)
            expect(progressCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    percent: 100,
                    uploadedChunks: 1,
                    totalChunks: 1,
                })
            )
            expect(fetch).toHaveBeenCalledTimes(3)
        })

        it("devrait uploader un gros fichier (plusieurs chunks)", async () => {
            const mockFile = new File(
                ["a".repeat(15 * 1024 * 1024)], // 15MB
                "large.mp4",
                { type: "video/mp4" }
            )

            const mockInitiateResponse = {
                upload_id: "large-upload-id",
                filename: "large.mp4",
                total_chunks: 3,
                total_size: 15 * 1024 * 1024,
            }

            const mockFinalizeResponse = {
                message: "success",
                file: {
                    id: "video-456",
                    url: "https://cdn.test.com/video-456.mp4",
                    title: "large.mp4",
                    owner_id: "user-1",
                    createdAt: "2026-01-01T00:00:00Z",
                    type: "video" as const,
                    mime: "video/mp4",
                    sizeBytes: 15 * 1024 * 1024,
                    sizeMB: "15.00",
                },
            }

            // Mock initiate
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockInitiateResponse,
            } as Response)

            // Mock 3 chunks uploads
            for (let i = 0; i < 3; i++) {
                rstest.mocked(fetch).mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        message: "chunk uploaded",
                        chunk_index: i,
                        upload_id: "large-upload-id",
                    }),
                } as Response)
            }

            // Mock finalize
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockFinalizeResponse,
            } as Response)

            const progressCallback = rstest.fn()
            const result = await uploader.upload(
                mockFile,
                progressCallback
            )

            expect(result).toEqual(mockFinalizeResponse)
            expect(progressCallback).toHaveBeenCalledTimes(4) // 3 chunks + 1 final
            expect(fetch).toHaveBeenCalledTimes(5) // initiate + 3 chunks + finalize
        })

        it("devrait gérer les erreurs d'initiation", async () => {
            const mockFile = new File(["test"], "test.mp4", {
                type: "video/mp4",
            })

            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: "Unauthorized" }),
            } as Response)

            await expect(uploader.upload(mockFile)).rejects.toThrow(
                "Unauthorized"
            )
        })

        it("devrait gérer les erreurs d'upload de chunk", async () => {
            const mockFile = new File(["test"], "test.mp4", {
                type: "video/mp4",
            })

            // Mock initiate success
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    upload_id: "test-id",
                    filename: "test.mp4",
                    total_chunks: 1,
                    total_size: 4,
                }),
            } as Response)

            // Mock chunk upload failure
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: "Chunk upload failed" }),
            } as Response)

            await expect(uploader.upload(mockFile)).rejects.toThrow(
                "Chunk upload failed"
            )
        })

        it("devrait gérer les erreurs de finalisation", async () => {
            const mockFile = new File(["test"], "test.mp4", {
                type: "video/mp4",
            })

            // Mock initiate
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    upload_id: "test-id",
                    filename: "test.mp4",
                    total_chunks: 1,
                    total_size: 4,
                }),
            } as Response)

            // Mock chunk upload success
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: "chunk uploaded" }),
            } as Response)

            // Mock finalize failure
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: "Finalization failed" }),
            } as Response)

            await expect(uploader.upload(mockFile)).rejects.toThrow(
                "Finalization failed"
            )
        })
    })

    describe("cancelUpload", () => {
        it("devrait annuler un upload avec succès", async () => {
            const uploadId = "test-upload-id"

            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: "Upload cancelled" }),
            } as Response)

            const result = await uploader.cancelUpload(uploadId)

            expect(result).toEqual({ message: "Upload cancelled" })
            expect(fetch).toHaveBeenCalledWith(
                `${mockApiUrl}/chunked/cancel/${uploadId}`,
                expect.objectContaining({
                    method: "DELETE",
                })
            )
        })

        it("devrait gérer les erreurs d'annulation", async () => {
            const uploadId = "test-upload-id"

            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: "Upload not found" }),
            } as Response)

            await expect(uploader.cancelUpload(uploadId)).rejects.toThrow(
                "Upload not found"
            )
        })
    })

    describe("calculateMD5", () => {
        it("devrait calculer le hash d'un blob", async () => {
            // Mock crypto.subtle.digest pour retourner un hash fictif
            const mockHash = new Uint8Array([
                0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99,
                0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
            ])

            rstest
                .mocked(crypto.subtle.digest)
                .mockResolvedValueOnce(mockHash.buffer as ArrayBuffer)

            // Utiliser une méthode publique qui utilise calculateMD5 en interne
            // Note: calculateMD5 est privée, donc on teste via upload
            const mockFile = new File(["test"], "test.mp4", {
                type: "video/mp4",
            })

            rstest
                .mocked(fetch)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        upload_id: "test",
                        filename: "test.mp4",
                        total_chunks: 1,
                        total_size: 4,
                    }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ message: "chunk uploaded" }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        message: "success",
                        file: {
                            id: "test",
                            url: "test",
                            title: "test",
                            sizeMB: 0,
                            type: "video",
                        },
                    }),
                } as Response)

            await uploader.upload(mockFile)

            // Vérifier que crypto.subtle.digest a été appelé
            expect(crypto.subtle.digest).toHaveBeenCalledWith(
                "SHA-256",
                expect.any(ArrayBuffer)
            )
        })
    })

    describe("Progress tracking", () => {
        it("devrait suivre la progression correctement", async () => {
            const mockFile = new File(
                ["a".repeat(10 * 1024 * 1024)], // 10MB
                "test.mp4",
                { type: "video/mp4" }
            )

            // Mock des réponses
            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    upload_id: "test",
                    filename: "test.mp4",
                    total_chunks: 2,
                    total_size: 10 * 1024 * 1024,
                }),
            } as Response)

            // 2 chunks
            rstest
                .mocked(fetch)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ message: "chunk 1" }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ message: "chunk 2" }),
                } as Response)

            rstest.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    message: "success",
                    file: {
                        id: "test",
                        url: "test",
                        title: "test",
                        sizeMB: 10,
                        type: "video",
                    },
                }),
            } as Response)

            const progressUpdates: UploadProgress[] = []
            const progressCallback = rstest.fn((progress: UploadProgress) => {
                progressUpdates.push(progress)
            })

            await uploader.upload(mockFile, progressCallback)

            // Vérifier que la progression a été suivie
            expect(progressUpdates.length).toBeGreaterThan(0)
            expect(progressUpdates[progressUpdates.length - 1].percent).toBe(
                100
            )
            expect(
                progressUpdates[progressUpdates.length - 1].uploadedChunks
            ).toBe(2)
        })
    })
})
