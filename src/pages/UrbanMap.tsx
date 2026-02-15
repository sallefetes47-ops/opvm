import React from 'react';
import MapSelector from '@/components/MapSelector';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export default function UrbanMap() {
    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">🗺️ الخريطة العمرانية</h1>
                    <p className="text-muted-foreground">تحديد وتبويب المواقع الجغرافية للملفات العقارية</p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>محدد المواقع</CardTitle>
                        <CardDescription aria-hidden="true">
                            استخدم الخريطة أدناه لتحديد موقع العقد أو الملف العمراني بدقة.
                            يمكنك البحث عن العنوان أو سحب العلامة على الخريطة.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MapSelector />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
