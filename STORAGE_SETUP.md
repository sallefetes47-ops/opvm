# Supabase Storage Setup for Legal Documents

## Overview
This document outlines the storage configuration required for the Documents Management System (Decrees, Instructions, and Procedures).

## Storage Bucket Configuration

### Legal Documents Bucket
Create a **public storage bucket** named `legal_documents` in Supabase:

```sql
-- In Supabase SQL Editor, run:
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal_documents', 'legal_documents', true)
ON CONFLICT (id) DO NOTHING;
```

### Storage Policies
Add the following RLS policies to the `storage.objects` table:

```sql
-- Allow authenticated users to view all legal documents
CREATE POLICY "Authenticated users can view legal documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'legal_documents'
  AND auth.role() = 'authenticated'
);

-- Allow non-viewers to upload legal documents
CREATE POLICY "Non-viewers can upload legal documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'legal_documents'
  AND auth.uid() IS NOT NULL
);

-- Allow admins to delete legal documents
CREATE POLICY "Admins can delete legal documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'legal_documents'
  AND has_role(auth.uid(), 'admin')
);
```

## File Upload Implementation

### Supported File Types
- **PDF**: `application/pdf`
- **Images**: `image/png`, `image/jpeg`, `image/webp`, `image/gif`

### File Size Limits
- **Maximum file size**: 20 MB
- **Recommended size**: < 4 MB for faster processing

### Upload Flow
1. User selects file via file input
2. File is validated (type & size)
3. On form submission, file is uploaded to `legal_documents` bucket
4. Public URL is generated
5. URL and filename are saved in `legal_documents` table

## File Deletion

### Process
1. When deleting a document:
   - System retrieves the file_name from database
   - File is deleted from storage bucket
   - Document record is deleted from database
   - User sees confirmation with Arabic message

2. **Rollback**: If file deletion fails, database deletion still proceeds

## Implementation Details

### Database Fields
```typescript
file_url: string | null;       // Public URL to the file
file_name: string | null;      // Storage path (for deletion)
```

### React Component Integration
See [LegalArchive.tsx](src/pages/LegalArchive.tsx) for:
- File upload form
- Delete confirmation with Arabic dialog
- High-resolution preview modal
- Filtering by document type

## Features

### 1. File Preview (Al-Mo3ayana - المعاينة)
- Eye icon opens high-resolution modal
- Supports PDF embedded display
- Supports image preview with zoom
- Responsive design

### 2. File Deletion (Al-Hadhf - الحذف)
- Trash icon with confirmation dialog
- Arabic confirmation text: "هل أنت متأكد من حذف هذا الملف؟"
- Removes file from both storage and database
- Admin-only access

### 3. Filtering
- Toggle between:
  - All (الكل)
  - Decrees (المراسيم)
  - Instructions (التعليمات)
  - Procedures (الإجراءات)
  - Other types...

### 4. Branding
- Capture.PNG as header image
- Golden color scheme (#D4AF37)
- Professional UI with proper spacing

## Troubleshooting

### Issue: "Storage bucket not found"
**Solution**: Ensure the `legal_documents` bucket exists and is public

### Issue: "Upload fails silently"
**Solution**: Check browser console for errors, verify file size < 20MB

### Issue: "Preview modal not showing"
**Solution**: Ensure file_url is properly saved in database

## Security Considerations

1. **RLS Policies**: All storage access is restricted to authenticated users
2. **Admin-Only Delete**: Only admins can delete documents
3. **Public Read**: All authenticated users can view documents
4. **File Size Limit**: 20MB maximum prevents abuse

## Testing Checklist

- [ ] Create Supabase storage bucket `legal_documents`
- [ ] Apply RLS policies for storage
- [ ] Test file upload with PDF
- [ ] Test file upload with image
- [ ] Test file preview
- [ ] Test file deletion
- [ ] Test filtering by document type
- [ ] Verify Arabic UI text displays correctly
- [ ] Check high-resolution preview works
