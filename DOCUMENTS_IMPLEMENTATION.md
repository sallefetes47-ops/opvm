# Documents Management System - Implementation Guide
## Decrees, Instructions, and Procedures (المراسيم والتعليمات والإجراءات)

### Overview
This guide documents the complete implementation of the updated Documents Management System with File Preview, File Deletion, Filtering, and Enhanced Branding features.

---

## 1. FILE PREVIEW (Al-Mo3ayana - المعاينة)

### Feature Description
Users can view PDF documents and images directly in the browser without downloading, using a high-resolution modal overlay.

### Implementation
**Component**: [LegalArchive.tsx - Preview Dialog](src/pages/LegalArchive.tsx#L600-L650)

#### Features:
- **Eye Icon**: Located in the "الإجراءات" (Actions) column
- **High-Resolution Modal**: 
  - Width: 90vw (90% of viewport width)
  - Height: 95vh (95% of viewport height)
  - Responsive design for all device sizes
  
#### Supported File Types:
- **PDF**: Embedded using `<iframe>` with PDF viewer
- **Images**: PNG, JPEG, WEBP, GIF with `<img>` tag and object-fit

#### Usage:
```tsx
<Button size="icon" variant="ghost" onClick={() => setPreviewDocument(doc)}>
  <Eye className="w-5 h-5 text-blue-600" />
</Button>
```

#### Backend:
- File URL stored in `legal_documents.file_url`
- File accessible via public Supabase storage URL
- No download required - streams directly in browser

---

## 2. FILE DELETION (Al-Hadhf - الحذف)

### Feature Description
Users can delete documents with a confirmation dialog in Arabic. Files are removed from both storage and database.

### Implementation
**Component**: [LegalArchive.tsx - Delete Functionality](src/pages/LegalArchive.tsx#L700-L750)

#### Confirmation Dialog:
```arabic
تأكيد الحذف
هل أنت متأكد من حذف هذا الملف؟
[Document Title]
هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الملف من الخادم والقاعدة البيانية.
```

#### Deletion Process:
1. User clicks trash icon (Trash2 - الحذف)
2. Arabic confirmation dialog appears
3. On confirmation:
   - Retrieve file_name from database
   - Delete file from Supabase storage bucket
   - Delete document record from database
   - Show success toast: "✅ تم الحذف"

#### Code:
```tsx
const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    // Get file info
    const { data: docData } = await supabase
      .from("legal_documents")
      .select("file_name")
      .eq("id", id)
      .single();

    // Delete from storage
    if (docData?.file_name) {
      await supabase.storage
        .from("legal_documents")
        .remove([docData.file_name]);
    }

    // Delete from database
    const { error } = await supabase
      .from("legal_documents")
      .delete()
      .eq("id", id);
  },
  // ... callbacks
});
```

### Access Control:
- **Admin-only**: Only users with `role === "admin"` can delete
- **Viewers**: Cannot see or access delete button

---

## 3. FILTERING (التصفية)

### Feature Description
Filter documents by type: Decrees, Instructions, Procedures, etc.

### Implementation
**Component**: [LegalArchive.tsx - Filter Section](src/pages/LegalArchive.tsx#L450-L480)

#### Available Filters:
```typescript
All (الكل):           typeFilter === "all"
Decrees (المراسيم):   typeFilter === "مرسوم"
Instructions (التعليمات): typeFilter === "تعليمة"
Procedures (الإجراءات):    typeFilter === "إجراء"
Decisions (القرارات):  typeFilter === "قرار"
Notices (المنشورات):   typeFilter === "منشور"
Laws (القوانين):      typeFilter === "قانون"
Orders (الأوامر):     typeFilter === "أمر"
```

#### Usage:
```tsx
<Select value={typeFilter} onValueChange={setTypeFilter}>
  <SelectTrigger className="w-56">
    <SelectValue placeholder="اختر النوع" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">الكل</SelectItem>
    <SelectItem value="مرسوم">المراسيم</SelectItem>
    <SelectItem value="تعليمة">التعليمات</SelectItem>
    <SelectItem value="إجراء">الإجراءات</SelectItem>
    {/* ... other filters */}
  </SelectContent>
</Select>
```

#### Search + Filter Combined:
```tsx
const filteredDocuments = documents?.filter(d => {
  // Search term matching
  if (term && !matches) return false;
  
  // Type filter
  if (typeFilter && typeFilter !== 'all' && d.document_type !== typeFilter) {
    return false;
  }
  return true;
});
```

---

## 4. FILE UPLOAD

### Feature Description
Users can upload PDF or image files along with document metadata.

### Implementation
**Component**: [LegalArchive.tsx - File Upload Section](src/pages/LegalArchive.tsx#L380-L420)

#### Supported Formats:
- PDF (application/pdf)
- PNG (image/png)
- JPEG (image/jpeg)
- WEBP (image/webp)
- GIF (image/gif)

#### Size Limits:
- **Maximum**: 20 MB
- **Recommended**: < 4 MB for optimal performance

#### Upload Form:
```tsx
<div className="space-y-2 border rounded-lg p-4 bg-slate-50">
  <Label className="flex items-center gap-2">
    <FileUp className="w-4 h-4" />
    تحميل ملف PDF أو صورة (اختياري)
  </Label>
  <input
    ref={fileInputRef}
    type="file"
    accept=".pdf,image/*"
    onChange={handleFileSelect}
  />
  {formData.file && (
    <div className="flex items-center gap-2 p-2 bg-green-50">
      <span>✓ {formData.file.name}</span>
    </div>
  )}
</div>
```

#### Upload Flow:
1. File selected via input
2. Validated on client (type & size)
3. On form submit:
   - Upload to Supabase storage (`legal_documents` bucket)
   - Generate public URL
   - Save URL and filename to database
   - Return success toast

#### Storage Upload Code:
```tsx
if (data.file) {
  const fileName_local = `${Date.now()}_${data.file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("legal_documents")
    .upload(fileName_local, data.file, {
      cacheControl: "3600",
      upsert: false,
    });

  const { data: publicUrl } = supabase.storage
    .from("legal_documents")
    .getPublicUrl(fileName_local);

  fileUrl = publicUrl.publicUrl;
  fileName = fileName_local;
}
```

---

## 5. BRANDING & UI

### Header Image
- **File**: `Capture.PNG`
- **Location**: `/public/Capture.PNG`
- **Display**: In table header with other document info
- **Code**:
```tsx
<div className="flex items-center gap-4">
  <img src="/Capture.PNG" alt="Bureau Logo" className="h-16 object-contain" />
  <CardTitle>قائمة الوثائق القانونية</CardTitle>
</div>
```

### Color Scheme
- **Primary Gold**: `#D4AF37`
- **Text**: `#2D2926` (Dark Brown)
- **Used for**: "Add Document" button, Save button

### Styling Highlights:
- **Arabic Right-to-Left**: All text properly aligned
- **Icons**: High-resolution from Lucide React
- **Responsive Design**: Mobile-first approach
- **Dark Mode Support**: Uses Tailwind CSS variables

---

## 6. DATABASE SCHEMA

### Legal Documents Table
```sql
CREATE TABLE public.legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_ar TEXT NOT NULL,              -- Arabic title
    title_fr TEXT,                       -- French title
    document_type TEXT NOT NULL,         -- Type: مرسوم, تعليمة, إجراء, etc.
    document_number TEXT,                -- Document number
    document_date DATE,                  -- Document date
    description TEXT,                    -- Description
    content_text TEXT,                   -- Full content for search
    keywords TEXT[],                     -- Array of keywords
    language TEXT DEFAULT 'ar',          -- Language: ar, fr, both
    file_url TEXT,                       -- Public URL to file
    file_name TEXT,                      -- Storage bucket path
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
```

---

## 7. STATE MANAGEMENT

### React Hooks Used:
```typescript
// Filters & Search
const [searchTerm, setSearchTerm] = useState("");
const [typeFilter, setTypeFilter] = useState("all");

// Dialogs
const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
const [viewDocument, setViewDocument] = useState(null);
const [previewDocument, setPreviewDocument] = useState(null);
const [docToDelete, setDocToDelete] = useState(null);
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

// Form
const [formData, setFormData] = useState<DocumentFormData>({
  title_ar: "",
  title_fr: "",
  document_type: "",
  document_number: "",
  document_date: undefined,
  description: "",
  content_text: "",
  keywords: "",
  language: "ar",
  file: null,  // NEW: File state
});

// Mutations (React Query)
const { data: documents, isLoading } = useQuery(...)
const createMutation = useMutation(...)
const deleteMutation = useMutation(...)
```

---

## 8. TESTING CHECKLIST

### Functional Tests:
- [ ] **Create**: Add new document with file
- [ ] **Upload**: File saves to storage
- [ ] **Preview**: Eye icon opens modal
- [ ] **Preview PDF**: PDF displays in iframe
- [ ] **Preview Image**: Image displays with proper sizing
- [ ] **Delete**: Trash icon shows confirmation
- [ ] **Delete Confirm**: Arabic dialog appears
- [ ] **Delete**: File removed from storage
- [ ] **Delete**: Document removed from database
- [ ] **Filter**: Type filter works for all options
- [ ] **Search**: Text search finds documents
- [ ] **Combined**: Search + filter work together

### UI/UX Tests:
- [ ] Arabic text displays correctly (RTL)
- [ ] Hero section shows Capture.PNG
- [ ] Icons are high resolution
- [ ] Modal is responsive on mobile
- [ ] Buttons are accessible
- [ ] Dark mode works correctly

### Security Tests:
- [ ] Non-admins cannot see delete button
- [ ] Only admins can delete documents
- [ ] File URLs are public but type-restricted
- [ ] File size limit enforced

---

## 9. MIGRATION GUIDE

### Step 1: Database
```bash
# Apply migration
supabase migration new setup_legal_documents_storage
# Edit migration file with provided SQL
supabase db push
```

### Step 2: Supabase Configuration
1. Go to Supabase Dashboard
2. Navigate to "Storage"
3. Verify `legal_documents` bucket exists
4. Verify policies are applied

### Step 3: Deploy
```bash
# Build and deploy application
npm run build
# Deploy to production
```

---

## 10. TROUBLESHOOTING

### Issue: "Upload fails"
**Check**:
- File size < 20 MB
- File type is PDF or image
- Storage bucket `legal_documents` exists
- RLS policies allow uploads

### Issue: "Preview doesn't show"
**Check**:
- file_url is not null in database
- File exists in storage bucket
- Storage bucket is public
- Browser console for CORS errors

### Issue: "Delete button not visible"
**Check**:
- Current user role is 'admin'
- User is authenticated

### Issue: "Filter doesn't work"
**Check**:
- document_type matches filter value exactly
- Type filter matches database values

---

## 11. FUTURE ENHANCEMENTS

Potential future improvements:
- [ ] Document versioning
- [ ] Word search highlighting
- [ ] Document sharing with specific users
- [ ] Batch upload
- [ ] Document signature/approval workflow
- [ ] Audit log for deletions
- [ ] Archive vs active documents
- [ ] Multi-language search
- [ ] Document OCR integration

---

## 12. API Reference

### Create Document
```typescript
supabase.from("legal_documents").insert({
  title_ar: string,
  title_fr?: string,
  document_type: string,
  document_number?: string,
  document_date?: string,
  description?: string,
  content_text?: string,
  keywords?: string[],
  language?: string,
  file_url?: string,
  file_name?: string,
  created_by?: string,
})
```

### Delete Document
```typescript
// 1. Delete file from storage
supabase.storage
  .from("legal_documents")
  .remove([fileName])

// 2. Delete record from database
supabase.from("legal_documents")
  .delete()
  .eq("id", documentId)
```

### Get Public File URL
```typescript
const { data } = supabase.storage
  .from("legal_documents")
  .getPublicUrl(fileName)
// URL: data.publicUrl
```

---

## Contact & Support
For issues or questions about this implementation, refer to the STORAGE_SETUP.md file or the application documentation.
