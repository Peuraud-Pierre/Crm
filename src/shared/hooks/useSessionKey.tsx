// useSessionKey.tsx
import { useState, useCallback } from "react";

function base64UrlToUint8Array(b64Url: string): Uint8Array {
	const padding = "=".repeat((4 - (b64Url.length % 4)) % 4);
	const base64 = (b64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const arr = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
	return arr;
}

export function useSessionKey() {
	const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

	const deriveKey = useCallback(
		async (password: string, salt_b64url: string, iterations = 200_000) => {
			if (!crypto?.subtle)
				throw new Error("Web Crypto API not available");

			console.log("🔑 Derivation start");
			const enc = new TextEncoder();
			const salt = base64UrlToUint8Array(salt_b64url);
			console.log("🧂 Salt (Uint8Array)", salt);

			// Import raw password as PBKDF2 base key
			const baseKey = await crypto.subtle.importKey(
				"raw",
				enc.encode(password),
				"PBKDF2",
				false,
				["deriveKey"]
			);
			console.log("🗝️ BaseKey imported", baseKey);

			// Derive AES-GCM 256-bit key
			const key = await crypto.subtle.deriveKey(
				{
					name: "PBKDF2",
					// Copie sur un ArrayBuffer (et non SharedArrayBuffer) pour
					// satisfaire le type BufferSource attendu (TS 5.7+).
					salt: new Uint8Array(salt),
					iterations,
					hash: "SHA-256",
				},
				baseKey,
				{ name: "AES-GCM", length: 256 },
				true,
				["encrypt", "decrypt"]
			);

			console.log("✅ SessionKey derived", key);

			setCryptoKey(key);
			return key;
		},
		[]
	);

	const clearKey = useCallback(() => {
		console.log("🗑️ Clearing session key");
		setCryptoKey(null);
	}, []);

	return { cryptoKey, deriveKey, clearKey };
}
