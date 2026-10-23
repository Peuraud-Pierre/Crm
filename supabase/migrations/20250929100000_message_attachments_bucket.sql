-- Create storage bucket for messaging attachments
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'message-attachments') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('message-attachments', 'message-attachments', true);
    END IF;
END;
$$;

-- Allow authenticated users to upload to their own folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can upload message attachments'
    ) THEN
        CREATE POLICY "Users can upload message attachments"
        ON storage.objects
        FOR INSERT
        WITH CHECK (
            bucket_id = 'message-attachments'
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END;
$$;

-- Allow anyone to read message attachments (bucket is public)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Anyone can view message attachments'
    ) THEN
        CREATE POLICY "Anyone can view message attachments"
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'message-attachments');
    END IF;
END;
$$;

-- Allow owners to delete their attachments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Users can delete their message attachments'
    ) THEN
        CREATE POLICY "Users can delete their message attachments"
        ON storage.objects
        FOR DELETE
        USING (
            bucket_id = 'message-attachments'
            AND auth.uid()::text = (storage.foldername(name))[1]
        );
    END IF;
END;
$$;
