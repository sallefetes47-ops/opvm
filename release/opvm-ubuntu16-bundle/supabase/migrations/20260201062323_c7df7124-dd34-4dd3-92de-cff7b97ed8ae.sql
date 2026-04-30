-- إضافة نوع عقد التعمير
CREATE TYPE public.permit_type AS ENUM ('رخصة بناء', 'رخصة تجزئة', 'رخصة هدم', 'شهادة تقسيم');

-- إضافة الحقول الجديدة للجدول
ALTER TABLE public.files
ADD COLUMN permit_type public.permit_type,
ADD COLUMN floors_count integer,
ADD COLUMN engineer_name text,
ADD COLUMN total_area numeric,
ADD COLUMN plots_count integer,
ADD COLUMN demolition_reason text,
ADD COLUMN work_duration text,
ADD COLUMN shares_count integer,
ADD COLUMN property_reference text,
ADD COLUMN rejection_reason text;