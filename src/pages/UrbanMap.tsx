import React, { useState } from 'react';
import { MzabValleyMap } from '../components/MzabValleyMap';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { jsPDF } from 'jspdf';

const UrbanMap = () => {
    const [parcelData, setParcelData] = useState({ section: '', ilot: '', owner: '' });

    // دالة لاستقبال البيانات من الخريطة
    const handleSelect = (data: { section: string, ilot: string }) => {
        setParcelData(prev => ({ ...prev, section: data.section, ilot: data.ilot }));
    };

    // دالة توليد ملف PDF للمرسوم 15-19
    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text("ديوان حماية وادي ميزاب", 105, 20, { align: "center" });
        doc.text("استمارة طلب تسوية (المرسوم 15-19)", 105, 30, { align: "center" });
        doc.text(`صاحب الطلب: ${parcelData.owner}`, 20, 50);
        doc.text(`القسم العقاري: ${parcelData.section}`, 20, 60);
        doc.text(`رقم مجموعة الملكية: ${parcelData.ilot}`, 20, 70);
        doc.save(`urban_contract_${parcelData.section}.pdf`);
    };

    return (
        <div style={{ display: 'flex', gap: '20px', padding: '20px', height: '90vh' }}>
            {/* قسم الخريطة - محمي بـ Error Boundary */}
            <div style={{ flex: 2, borderRadius: '15px', overflow: 'hidden', border: '1px solid #ddd' }}>
                <MapErrorBoundary>
                    <MzabValleyMap onParcelSelect={handleSelect} />
                </MapErrorBoundary>
            </div>

            {/* قسم الاستمارة */}
            <div style={{ flex: 1, padding: '20px', background: '#f9f9f9', borderRadius: '15px' }}>
                <h2 style={{ color: '#d32f2f' }}>بيانات التسوية العمرانية</h2>
                <hr />
                <div style={{ marginTop: '20px' }}>
                    <label>القسم (آلي من الخريطة):</label>
                    <input type="text" value={parcelData.section} readOnly style={inputStyle} />

                    <label>المجموعة (آلي من الخريطة):</label>
                    <input type="text" value={parcelData.ilot} readOnly style={inputStyle} />

                    <label>اسم صاحب الطلب:</label>
                    <input
                        type="text"
                        placeholder="أدخل الاسم هنا"
                        onChange={(e) => setParcelData({ ...parcelData, owner: e.target.value })}
                        style={inputStyle}
                    />

                    <button
                        onClick={exportToPDF}
                        disabled={!parcelData.section}
                        style={btnStyle}>
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