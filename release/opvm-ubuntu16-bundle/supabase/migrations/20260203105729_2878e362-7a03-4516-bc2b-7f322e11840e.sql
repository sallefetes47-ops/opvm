-- Create meeting_minutes table for محاضر الجلسات
CREATE TABLE public.meeting_minutes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_date DATE NOT NULL,
    session_number TEXT,
    attendees TEXT[],
    agenda TEXT,
    decisions TEXT,
    notes TEXT,
    file_url TEXT,
    file_name TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for meeting_minutes
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

-- RLS policies for meeting_minutes
CREATE POLICY "Authenticated users can view meeting minutes"
ON public.meeting_minutes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Non-viewers can create meeting minutes"
ON public.meeting_minutes FOR INSERT
TO authenticated
WITH CHECK (NOT has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins can update meeting minutes"
ON public.meeting_minutes FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete meeting minutes"
ON public.meeting_minutes FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create summons table for استدعاءات الشباك الواحد
CREATE TABLE public.summons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    summons_date DATE NOT NULL,
    summons_number TEXT,
    committee_members TEXT[],
    venue TEXT,
    attendance_status TEXT,
    notes TEXT,
    file_url TEXT,
    file_name TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for summons
ALTER TABLE public.summons ENABLE ROW LEVEL SECURITY;

-- RLS policies for summons
CREATE POLICY "Authenticated users can view summons"
ON public.summons FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Non-viewers can create summons"
ON public.summons FOR INSERT
TO authenticated
WITH CHECK (NOT has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins can update summons"
ON public.summons FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete summons"
ON public.summons FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create legal_documents table for المراسيم والتعليمات
CREATE TABLE public.legal_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title_ar TEXT NOT NULL,
    title_fr TEXT,
    document_type TEXT NOT NULL,
    document_number TEXT,
    document_date DATE,
    description TEXT,
    content_text TEXT,
    keywords TEXT[],
    language TEXT DEFAULT 'ar',
    file_url TEXT,
    file_name TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for legal_documents
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for legal_documents
CREATE POLICY "Authenticated users can view legal documents"
ON public.legal_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Non-viewers can create legal documents"
ON public.legal_documents FOR INSERT
TO authenticated
WITH CHECK (NOT has_role(auth.uid(), 'viewer'));

CREATE POLICY "Admins can update legal documents"
ON public.legal_documents FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete legal documents"
ON public.legal_documents FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_meeting_minutes_updated_at
    BEFORE UPDATE ON public.meeting_minutes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_summons_updated_at
    BEFORE UPDATE ON public.summons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at
    BEFORE UPDATE ON public.legal_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();