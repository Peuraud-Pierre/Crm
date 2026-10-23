CryptedMessage cleanup notes
Date: 2026-01-23

Summary
- Removed unused cryptedmessage context/provider to avoid double Supabase subscriptions.
- Removed unused crypto helpers.
- Added object URL cleanup to prevent memory leaks for decrypted files/images.
- Sanitized uploaded file names and added randomness to storage paths.
- Removed empty directories under components.

Details by file
- Nokk_project/src/app/routes/AuthRoutes.tsx
  - Removed CryptedMessageProvider wrapper for the messages route.
- Nokk_project/src/features/messages/cryptedmessage/index.ts
  - Removed export of CryptedMessageContext.
- Nokk_project/src/features/messages/cryptedmessage/hooks/crypto.ts
  - Removed unused exports: encryptSecretKeyForStorage, decryptSecretKeyFromStorage, deriveChainKey, advanceRatchet.
- Nokk_project/src/features/messages/cryptedmessage/hooks/useCryptedMessages.ts
  - Track and revoke object URLs for decrypted images/files.
  - Added sanitizeFileName helper and safer storage path generation.
- Removed empty folders:
  - Nokk_project/src/features/messages/cryptedmessage/components/security
  - Nokk_project/src/features/messages/cryptedmessage/components/user

Notes
- Files referenced in IDE tabs (SecurityPanel.tsx, UserList.tsx, useRealtime.ts, useMessageManager.ts) were not found in the repo.
