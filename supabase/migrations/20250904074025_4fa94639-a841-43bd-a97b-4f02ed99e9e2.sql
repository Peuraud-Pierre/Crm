-- Add 'Refusé' to the allowed ticket statuses
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('Envoyé', 'Reçu', 'Traité', 'Terminé', 'Refusé'));

-- Make ticket-attachments bucket public for easier file access
UPDATE storage.buckets SET public = true WHERE id = 'ticket-attachments';