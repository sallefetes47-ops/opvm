import React, { useState } from 'react';
import MzabValleyMap from '../components/MzabValleyMap';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { jsPDF } from 'jspdf';
import { Card, CardContent } from '@/components/ui/card';
import { Grid, Layers, MapPin, Ruler } from 'lucide-react';

type ParcelFormState = {
    municipality: string;
    section: string;
    propertyGroup: string;
    area: number | null;
};

type InfoCardProps = {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    className?: string;
    iconClassName?: string;
};

const InfoCard = ({ label, value, icon: Icon, className = '', iconClassName = '' }: InfoCardProps) => (
    <Card className={`border shadow-sm ${className}`}>
        <CardContent className='p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div className='text-right'>
                    <p className='mb-1 text-xs font-medium text-muted-foreground'>{label}</p>
                    <p className='text-lg font-bold leading-tight text-slate-900'>{value || '---'}</p>
                </div>
                <div className={`rounded-md p-2 ${iconClassName}`}>
                    <Icon className='h-5 w-5' />
                </div>
            </div>
        </CardContent>
    </Card>
);

const UrbanMap = () => {
    const [parcelData, setParcelData] = useState<ParcelFormState>({
        municipality: '',
        section: '',
        propertyGroup: '',
        area: null,
    });

    const handleSelect = (data: ParcelFormState) => {
        setParcelData(data);
    };

    const formatArea = (area: number | null) => (area === null ? '' : `${area.toLocaleString('en-US', { maximumFractionDigits: 2 })} m²`);

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('ديوان حماية وادي ميزاب', 105, 20, { align: 'center' });
        doc.text('استمارة طلب تسوية (المرسوم 15-19)', 105, 30, { align: 'center' });
        doc.text(`البلدية: ${parcelData.municipality}`, 20, 50);
        doc.text(`القسم العقاري: ${parcelData.section}`, 20, 60);
        doc.text(`رقم مجموعة الملكية: ${parcelData.propertyGroup}`, 20, 70);
        doc.text(`مساحة القطعة: ${formatArea(parcelData.area)}`, 20, 80);
        doc.save(`urban_contract_${parcelData.section}.pdf`);
    };

    return (
        <div className='grid h-[90vh] grid-cols-1 gap-5 p-5 lg:grid-cols-3'>
            <div className='overflow-hidden rounded-2xl border border-slate-200 lg:col-span-2'>
                <MapErrorBoundary>
                    <MzabValleyMap onParcelSelect={handleSelect} />
                </MapErrorBoundary>
            </div>

            <Card className='flex h-full flex-col rounded-2xl border-slate-200 bg-slate-50/80'>
                <CardContent className='flex h-full flex-col p-5 text-right'>
                    <div className='mb-5'>
                        <div className='mb-3 h-1 w-16 rounded-full bg-[#7b1e1e]' />
                        <h2 className='text-xl font-bold text-[#7b1e1e]'>معلومات المسح العقاري</h2>
                    </div>

                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <InfoCard
                            label='البلدية'
                            value={parcelData.municipality}
                            icon={MapPin}
                            className='border-slate-200 bg-slate-100/90'
                            iconClassName='bg-slate-200/80 text-slate-700'
                        />
                        <InfoCard
                            label='مساحة القطعة'
                            value={formatArea(parcelData.area)}
                            icon={Ruler}
                            className='border-emerald-200 bg-emerald-50'
                            iconClassName='bg-emerald-100 text-emerald-700'
                        />
                        <InfoCard
                            label='رقم القسم'
                            value={parcelData.section}
                            icon={Grid}
                            className='border-rose-100 bg-rose-50/70'
                            iconClassName='bg-rose-100/90 text-rose-700'
                        />
                        <InfoCard
                            label='مجموعة الملكية'
                            value={parcelData.propertyGroup}
                            icon={Layers}
                            className='border-amber-100 bg-amber-50/70'
                            iconClassName='bg-amber-100/90 text-amber-700'
                        />
                    </div>

                    <div className='mt-5'>
                        <button
                            onClick={exportToPDF}
                            disabled={!parcelData.section}
                            className='w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            طباعة عقد التعمير (PDF)
                        </button>
                    </div>

                    <div className='mt-auto pt-6'>
                        <div className='mb-3 h-px w-full bg-slate-200' />
                        <p className='text-center text-[11px] font-light tracking-[0.02em] text-slate-500'>
                            جميع الحقوق محفوظة © 2026 - تم التطوير بواسطة User لصالح ديوان حماية وادي ميزاب
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default UrbanMap;
