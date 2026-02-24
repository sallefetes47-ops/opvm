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
    actualArea: number | null;
    cadastralArea: number | null;
};

type InfoCardProps = {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    className?: string;
    iconClassName?: string;
};

const InfoCard = ({ label, value, icon: Icon, className = '', iconClassName = '' }: InfoCardProps) => (
    <Card className={`border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${className}`}>
        <CardContent className='p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div className='text-right'>
                    <p className='mb-1 text-[11px] font-semibold tracking-wide text-slate-500'>{label}</p>
                    <p className='text-lg font-bold leading-tight text-slate-900'>{value || '---'}</p>
                </div>
                <div className={`rounded-xl p-2.5 shadow-sm ${iconClassName}`}>
                    <Icon className='h-4 w-4' />
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
        actualArea: null,
        cadastralArea: null,
    });

    const handleSelect = (data: ParcelFormState) => {
        setParcelData(data);
    };

    const formatActualArea = (area: number | null) => (area === null ? '' : `${area.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`);
    const formatCadastralArea = (area: number | null) => (area === null ? '' : `${area.toLocaleString('en-US')} m²`);

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('ديوان حماية وادي ميزاب', 105, 20, { align: 'center' });
        doc.text('استمارة طلب تسوية (المرسوم 15-19)', 105, 30, { align: 'center' });
        doc.text(`البلدية: ${parcelData.municipality}`, 20, 50);
        doc.text(`القسم العقاري: ${parcelData.section}`, 20, 60);
        doc.text(`رقم مجموعة الملكية: ${parcelData.propertyGroup}`, 20, 70);
        doc.text(`المساحة الحقيقية: ${formatActualArea(parcelData.actualArea)}`, 20, 80);
        doc.text(`مساحة المسح: ${formatCadastralArea(parcelData.cadastralArea)}`, 20, 90);
        doc.save(`urban_contract_${parcelData.section}.pdf`);
    };

    return (
        <div className='grid h-[90vh] grid-cols-1 gap-5 p-5 lg:grid-cols-3'>
            <div className='overflow-hidden rounded-2xl border border-slate-200 lg:col-span-2'>
                <MapErrorBoundary>
                    <MzabValleyMap onParcelSelect={handleSelect} />
                </MapErrorBoundary>
            </div>

            <Card className='flex h-full flex-col rounded-2xl border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80'>
                <CardContent className='flex h-full flex-col p-5 text-right'>
                    <div className='mb-5 rounded-xl border border-rose-100 bg-white/80 p-3 shadow-sm'>
                        <div className='mb-3 h-1 w-16 rounded-full bg-[#7b1e1e]' />
                        <h2 className='text-xl font-bold text-[#7b1e1e]'>معلومات المسح العقاري</h2>
                    </div>

                    <div className='grid grid-cols-2 gap-3'>
                        <InfoCard
                            label='البلدية'
                            value={parcelData.municipality}
                            icon={MapPin}
                            className='border-indigo-100 bg-indigo-50/80'
                            iconClassName='bg-indigo-100 text-indigo-700'
                        />
                        <InfoCard
                            label='المساحة الحقيقية (m²)'
                            value={formatActualArea(parcelData.actualArea)}
                            icon={Ruler}
                            className='border-emerald-200 bg-emerald-50'
                            iconClassName='bg-emerald-100 text-emerald-700'
                        />
                        <InfoCard
                            label='مساحة المسح (m²)'
                            value={formatCadastralArea(parcelData.cadastralArea)}
                            icon={Ruler}
                            className='border-cyan-100 bg-cyan-50/80'
                            iconClassName='bg-cyan-100 text-cyan-700'
                        />
                        <InfoCard
                            label='رقم القسم'
                            value={parcelData.section}
                            icon={Grid}
                            className='border-rose-100 bg-rose-50/80'
                            iconClassName='bg-rose-100/90 text-rose-700'
                        />
                        <InfoCard
                            label='مجموعة الملكية'
                            value={parcelData.propertyGroup}
                            icon={Layers}
                            className='col-span-2 border-amber-100 bg-amber-50/80'
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
                </CardContent>
            </Card>
        </div>
    );
};

export default UrbanMap;
