-- Create storage bucket for legal documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('legal_documents', 'legal_documents', true, true, 20971520, '{"application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"}')
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = '{"application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"}'
;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view legal documents" ON storage.objects;
DROP POLICY IF EXISTS "Non-viewers can upload legal documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete legal documents" ON storage.objects;

-- Create storage policies for legal_documents bucket
-- Policy 1: Allow authenticated users to read/view files
CREATE POLICY "Authenticated users can view legal documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'legal_documents'
  AND auth.role() = 'authenticated'
);

-- Policy 2: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to legal documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'legal_documents'
  AND auth.uid() IS NOT NULL
);

-- Policy 3: Allow admins to delete files
CREATE POLICY "Admins can delete legal documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'legal_documents'
  AND has_role(auth.uid(), 'admin')
);

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
