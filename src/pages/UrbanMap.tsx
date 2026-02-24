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
        area === null ? '' : `${area.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mآ²`;
    const formatCadastralArea = (area: number | null) => (area === null ? '' : `${area.toLocaleString('en-US')} mآ²`);
    const auditStatus = parcelData.section ? 'طھظ… ط§ظ„طھط­ط¯ظٹط¯' : 'ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ط§ط®طھظٹط§ط±';

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('ط¯ظٹظˆط§ظ† ط­ظ…ط§ظٹط© ظˆط§ط¯ظٹ ظ…ظٹط²ط§ط¨', 105, 20, { align: 'center' });
        doc.text('ط§ط³طھظ…ط§ط±ط© ط·ظ„ط¨ طھط³ظˆظٹط© (ط§ظ„ظ…ط±ط³ظˆظ… 15-19)', 105, 30, { align: 'center' });
        doc.text(`ط§ظ„ط¨ظ„ط¯ظٹط©: ${parcelData.municipality}`, 20, 50);
        doc.text(`ط§ظ„ظ‚ط³ظ… ط§ظ„ط¹ظ‚ط§ط±ظٹ: ${parcelData.section}`, 20, 60);
        doc.text(`ط±ظ‚ظ… ظ…ط¬ظ…ظˆط¹ط© ط§ظ„ظ…ظ„ظƒظٹط©: ${parcelData.propertyGroup}`, 20, 70);
        doc.text(`ط§ظ„ظ…ط³ط§ط­ط© ط§ظ„ط­ظ‚ظٹظ‚ظٹط©: ${formatActualArea(parcelData.actualArea)}`, 20, 80);
        doc.text(`ظ…ط³ط§ط­ط© ط§ظ„ظ…ط³ط­: ${formatCadastralArea(parcelData.cadastralArea)}`, 20, 90);
        doc.save(`urban_contract_${parcelData.section}.pdf`);
    };

    const handleSmartSearch = () => {
        const payload: ParcelSearchPayload = {
            municipalityCode: searchMunicipalityCode,
            section: searchSection,
            group: searchGroup,
        };
        const result = mapRef.current?.searchParcel(payload);
        setSearchMessage(result?.message ?? 'ط§ظ„ط®ط±ظٹط·ط© ط؛ظٹط± ط¬ط§ظ‡ط²ط© ط¨ط¹ط¯.');
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
                            <h2 className='text-xl font-bold text-[#7b1e1e]'>ظ…ط¹ظ„ظˆظ…ط§طھ ط§ظ„ظ…ط³ط­ ط§ظ„ط¹ظ‚ط§ط±ظٹ</h2>
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <InfoCard
                                label='ط§ظ„ط¨ظ„ط¯ظٹط©'
                                value={parcelData.municipality}
                                icon={MapPin}
                                className='border-indigo-100 bg-indigo-50/80'
                                iconClassName='bg-indigo-100 text-indigo-700'
                            />
                            <InfoCard
                                label='ط±ظ‚ظ… ط§ظ„ظ‚ط³ظ…'
                                value={parcelData.section}
                                icon={Grid}
                                className='border-rose-100 bg-rose-50/80'
                                iconClassName='bg-rose-100/90 text-rose-700'
                            />
                            <InfoCard
                                label='ظ…ط¬ظ…ظˆط¹ط© ط§ظ„ظ…ظ„ظƒظٹط©'
                                value={parcelData.propertyGroup}
                                icon={Layers}
                                className='border-amber-100 bg-amber-50/80'
                                iconClassName='bg-amber-100/90 text-amber-700'
                            />
                            <InfoCard
                                label='ط§ظ„ط­ط§ظ„ط©'
                                value={auditStatus}
                                icon={Layers}
                                className='border-slate-200 bg-slate-100/80'
                                iconClassName='bg-slate-200 text-slate-700'
                            />
                            <InfoCard
                                label='ط§ظ„ظ…ط³ط§ط­ط© ط§ظ„ط­ظ‚ظٹظ‚ظٹط© (ظ…آ²)'
                                value={formatActualArea(parcelData.actualArea)}
                                icon={Ruler}
                                className='border-emerald-200 bg-emerald-50'
                                iconClassName='bg-emerald-100 text-emerald-700'
                            />
                            <InfoCard
                                label='ظ…ط³ط§ط­ط© ط§ظ„ظ…ط³ط­ (ظ…آ²)'
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
                                ط·ط¨ط§ط¹ط© ط¹ظ‚ط¯ ط§ظ„طھط¹ظ…ظٹط± (PDF)
                            </button>
                        </div>
                    </CardContent>
                </Card>

                <Card className='rounded-2xl border-slate-200 bg-white/95'>
                    <CardContent className='p-5 text-right'>
                        <div className='mb-3 flex items-center justify-between'>
                            <h3 className='text-base font-bold text-slate-800'>ظ†ط§ظپط°ط© ط§ظ„ط¨ط­ط« ط§ظ„ط°ظƒظٹ</h3>
                            <Search className='h-4 w-4 text-slate-500' />
                        </div>
                        <div className='grid grid-cols-1 gap-2'>
                            <select
                                value={searchMunicipalityCode}
                                onChange={(e) => setSearchMunicipalityCode(e.target.value)}
                                className='rounded-md border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-emerald-400'
                            >
                                <option value=''>ط§ط®طھط± ط§ظ„ط¨ظ„ط¯ظٹط©</option>
                                <option value='4701'>ط؛ط±ط¯ط§ظٹط© (4701)</option>
                                <option value='4707'>ط§ظ„ط¹ط·ظپ (4707)</option>
                                <option value='4710'>ط¨ظ†ظˆط±ط© (4710)</option>
                                <option value='4703'>ط§ظ„ط¶ط§ظٹط© (4703)</option>
                                <option value='4705'>ظ…طھظ„ظٹظ„ظٹ (4705)</option>
                            </select>
                            <input
                                value={searchSection}
                                onChange={(e) => setSearchSection(e.target.value)}
                                placeholder='ط±ظ‚ظ… ط§ظ„ظ‚ط³ظ…'
                                className='rounded-md border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-emerald-400'
                            />
                            <input
                                value={searchGroup}
                                onChange={(e) => setSearchGroup(e.target.value)}
                                placeholder='ظ…ط¬ظ…ظˆط¹ط© ط§ظ„ظ…ظ„ظƒظٹط©'
                                className='rounded-md border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-emerald-400'
                            />
                            <div className='mt-1 grid grid-cols-2 gap-2'>
                                <button
                                    type='button'
                                    onClick={handleSmartSearch}
                                    className='rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700'
                                >
                                    ط¨ط­ط«
                                </button>
                                <button
                                    type='button'
                                    onClick={handleClearSearch}
                                    className='rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
                                >
                                    ظ…ط³ط­
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


