import React from 'react';
import MzabMap from '../components/MzabMap'; // استيراد المكون الذي برمجناه مع Gemini

const UrbanMap: React.FC = () => {
    return (
        <div style={{ padding: '20px', height: '100%' }}>
            <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>
                المخطط المسحي العقاري - وادي ميزاب (المرسوم 15-19)
            </h2>

            <div style={{
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                {/* استدعاء الخريطة التي تحتوي على بيانات القسم ومجموعة الملكية */}
                <MzabMap />
            </div>

            <div style={{ marginTop: '15px', color: '#666', fontSize: '14px' }}>
                💡 نصيحة: اضغط على أي قطعة أرضية لاستخراج القسم (Section) ومجموعة الملكية (Ilot) آلياً.
            </div>
        </div>
    );
};

export default UrbanMap;