import React, { useState } from 'react';
import MzabValleyMap from '../components/MzabValleyMap';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { jsPDF } from 'jspdf';

type ParcelFormState = {
    municipality: string;
    section: string;
    propertyGroup: string;
    area: number | null;
};

const UrbanMap = () => {
    const [parcelData, setParcelData] = useState<ParcelFormState>({
        municipality: '',
        section: '',
        propertyGroup: '',
        area: null,
    });

    const handleSelect = (data: ParcelFormState) => {
        // Single state update to keep all four fields in sync on map click
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
        <div style={{ display: 'flex', gap: '20px', padding: '20px', height: '90vh' }}>
            <div style={{ flex: 2, borderRadius: '15px', overflow: 'hidden', border: '1px solid #ddd' }}>
                <MapErrorBoundary>
                    <MzabValleyMap onParcelSelect={handleSelect} />
                </MapErrorBoundary>
            </div>

            <div style={{ flex: 1, padding: '20px', background: '#f9f9f9', borderRadius: '15px' }}>
                <h2 style={{ color: '#d32f2f' }}>معلومات المسح العقاري</h2>
                <hr />
                <div style={{ marginTop: '20px' }}>
                    <label>البلدية:</label>
                    <input
                        type='text'
                        value={parcelData.municipality}
                        onChange={(e) => setParcelData(prev => ({ ...prev, municipality: e.target.value }))}
                        style={inputStyle}
                    />

                    <label>رقم القسم (آلي من الخريطة):</label>
                    <input type='text' value={parcelData.section} readOnly style={inputStyle} />

                    <label>رقم مجموعة الملكية (آلي من الخريطة):</label>
                    <input type='text' value={parcelData.propertyGroup} readOnly style={inputStyle} />

                    <label>مساحة القطعة:</label>
                    <input type='text' value={formatArea(parcelData.area)} readOnly style={inputStyle} />

                    <button onClick={exportToPDF} disabled={!parcelData.section} style={btnStyle}>
                        طباعة عقد التعمير (PDF)
                    </button>
                </div>
            </div>
        </div>
    );
};

const inputStyle = { width: '100%', padding: '10px', margin: '10px 0', borderRadius: '5px', border: '1px solid #ccc' };
const btnStyle = { width: '100%', padding: '15px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };

export default UrbanMap;
