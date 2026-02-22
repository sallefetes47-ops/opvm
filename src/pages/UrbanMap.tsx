import React, { useState } from 'react';
import MzabMap from '../components/MzabMap';

const UrbanMap: React.FC = () => {
    // حالة تخزين بيانات القطعة المختارة
    const [formData, setFormData] = useState({ section: '', ilot: '' });

    const handleParcelSelect = (data: { section: string; ilot: string }) => {
        setFormData(data); // ملء البيانات آلياً عند الضغط على الخريطة
    };

    return (
        <div style={{ display: 'flex', gap: '20px', padding: '20px', height: '100%' }}>

            {/* القسم الأيمن: الخريطة التفاعلية */}
            <div style={{ flex: 2 }}>
                <h3 style={{ marginBottom: '10px' }}>اختر القطعة الأرضية من المخطط (وادي ميزاب)</h3>
                <MzabMap onParcelSelect={handleParcelSelect} />
            </div>

            {/* القسم الأيسر: استمارة المرسوم 15-19 */}
            <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <h3 style={{ color: '#d32f2f', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>طلب تسوية (المرسوم 15-19)</h3>

                <form style={{ marginTop: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>القسم العقاري (Section):</label>
                        <input
                            type="text"
                            value={formData.section}
                            readOnly // القيمة تأتي من الخريطة مباشرة
                            style={{ width: '100%', padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>مجموعة الملكية (Ilot):</label>
                        <input
                            type="text"
                            value={formData.ilot}
                            readOnly
                            style={{ width: '100%', padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}
                        />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>اسم صاحب الطلب:</label>
                        <input type="text" style={{ width: '100%', padding: '8px' }} placeholder="أدخل الاسم الكامل" />
                    </div>

                    <button type="button" style={{ width: '100%', padding: '10px', backgroundColor: '#2c3e50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        حفظ وإصدار عقد التعمير
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UrbanMap;