import React, { useRef, useState } from 'react';
import MzabValleyMap, { type MzabValleyMapHandle, type ParcelSearchPayload, type ParcelSelectionData } from '../components/MzabValleyMap';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { jsPDF } from 'jspdf';
import { Card, CardContent } from '@/components/ui/card';
import { Grid, Layers, MapPin, Ruler, Search } from 'lucide-react';

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
    const mapRef = useRef<MzabValleyMapHandle>(null);

    const [parcelData, setParcelData] = useState<ParcelSelectionData>({
        municipality: '',
        section: '',
        propertyGroup: '',
        actualArea: null,
        cadastralArea: null,
    });

    const [searchMunicipalityCode, setSearchMunicipalityCode] = useState('');
    const [searchSection, setSearchSection] = useState('');
    const [searchGroup, setSearchGroup] = useState('');
    const [searchMessage, setSearchMessage] = useState('');

    const handleSelect = (data: ParcelSelectionData) => {
        setParcelData(data);
    };

    const formatActualArea = (area: number | null) =>
        area === null ? '' : `${area.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
    const formatCadastralArea = (area: number | null) => (area === null ? '' : `${area.toLocaleString('en-US')} m²`);
    const auditStatus = parcelData.section ? 'تم التحديد' : 'بانتظار الاختيار';

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

    const handleSmartSearch = () => {
        const payload: ParcelSearchPayload = {
            municipalityCode: searchMunicipalityCode,
            section: searchSection,
            group: searchGroup,
        };
        const result = mapRef.current?.searchParcel(payload);
        setSearchMessage(result?.message ?? 'الخريطة غير جاهزة بعد.');
    };

    const handleClearSearch = () => {
        setSearchMunicipalityCode('');
        setSearchSection('');
        setSearchGroup('');
        setSearchMessage('');
        mapRef.current?.clearSearch();
    };

    return (
        <div className='grid h-[90vh] grid-cols-1 gap-5 p-5 lg:grid-cols-3'>
            <div className='overflow-hidden rounded-2xl border border-slate-200 lg:col-span-2'>
                <MapErrorBoundary>
                    <MzabValleyMap ref={mapRef} onParcelSelect={handleSelect} />
                </MapErrorBoundary>
            </div>

            <div className='flex h-full flex-col gap-4'>
                <Card className='rounded-2xl border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80'>
                    <CardContent className='p-5 text-right'>
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
                                className='border-amber-100 bg-amber-50/80'
                                iconClassName='bg-amber-100/90 text-amber-700'
                            />
                            <InfoCard
                                label='الحالة'
                                value={auditStatus}
                                icon={Layers}
                                className='border-slate-200 bg-slate-100/80'
                                iconClassName='bg-slate-200 text-slate-700'
                            />
                            <InfoCard
                                label='المساحة الحقيقية (م²)'
                                value={formatActualArea(parcelData.actualArea)}
                                icon={Ruler}
                                className='border-emerald-200 bg-emerald-50'
                                iconClassName='bg-emerald-100 text-emerald-700'
                            />
                            <InfoCard
                                label='مساحة المسح (م²)'
                                value={formatCadastralArea(parcelData.cadastralArea)}
                                icon={Ruler}
                                className='border-teal-300 bg-teal-50/90 ring-1 ring-teal-200'
                                iconClassName='bg-teal-100 text-teal-700'
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

                <Card className='rounded-2xl border-slate-200 bg-white/95'>
                    <CardContent className='p-5 text-right'>
                        <div className='mb-3 flex items-center justify-between'>
                            <h3 className='text-base font-bold text-slate-800'>نافذة البحث الذكي</h3>
                            <Search className='h-4 w-4 text-slate-500' />
                        </div>
                        <div className='grid grid-cols-1 gap-2'>
                            <select
                                value={searchMunicipalityCode}
                                onChange={(e) => setSearchMunicipalityCode(e.target.value)}
                                className='rounded-md border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-emerald-400'
                            >
                                <option value=''>اختر البلدية</option>
                                <option value='4701'>غرداية (4701)</option>
                                <option value='4707'>العطف (4707)</option>
                                <option value='4710'>بنورة (4710)</option>
                                <option value='4703'>بلدية الضاية (4703)</option>
                                <option value='4705'>متليلي (4705)</option>
                            </select>
                            <input
                                value={searchSection}
                                onChange={(e) => setSearchSection(e.target.value)}
                                placeholder='رقم القسم'
                                className='rounded-md border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-emerald-400'
                            />
                            <input
                                value={searchGroup}
                                onChange={(e) => setSearchGroup(e.target.value)}
                                placeholder='مجموعة الملكية'
                                className='rounded-md border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-emerald-400'
                            />
                            <div className='mt-1 grid grid-cols-2 gap-2'>
                                <button
                                    type='button'
                                    onClick={handleSmartSearch}
                                    className='rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700'
                                >
                                    بحث
                                </button>
                                <button
                                    type='button'
                                    onClick={handleClearSearch}
                                    className='rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
                                >
                                    مسح
                                </button>
                            </div>
                        </div>
                        {searchMessage && <p className='mt-3 text-xs text-slate-600'>{searchMessage}</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UrbanMap;
