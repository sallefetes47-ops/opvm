import React, { useState } from 'react';
import MzabMap from '../components/MzabMap';
import { jsPDF } from 'jspdf';

const UrbanMap: React.FC = () => {
  const [formData, setFormData] = useState({ 
    ownerName: '', 
    section: '', 
    ilot: '',
    date: new Date().toLocaleDateString('ar-DZ')
  });

  const handleParcelSelect = (data: { section: string; ilot: string }) => {
    setFormData(prev => ({ ...prev, section: data.section, ilot: data.ilot }));
  };

  // دالة توليد ملف الـ PDF الرسمي
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // إعداد التنسيق العام (ملاحظة: لطباعة العربية بطلاقة يفضل إضافة خط عريض)
    doc.setFontSize(22);
    doc.text("ديوان حماية وادي ميزاب", 105, 20, { align: "center" });
    
    doc.setFontSize(16);
    doc.text("استمارة طلب تسوية - المرسوم 15-19", 105, 35, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.line(20, 40, 190, 40);

    doc.setFontSize(12);
    doc.text(`التاريخ: ${formData.date}`, 190, 50, { align: "right" });
    doc.text(`صاحب الطلب: ${formData.ownerName}`, 190, 70, { align: "right" });
    
    // بيانات القطعة المستخرجة من الخريطة
    doc.setFontSize(14);
    doc.text("تفاصيل الوعاء العقاري:", 190, 90, { align: "right" });
    doc.text(`القسم العقاري (Section): ${formData.section}`, 180, 105, { align: "right" });
    doc.text(`مجموعة الملكية (Ilot): ${formData.ilot}`, 180, 115, { align: "right" });

    doc.setFontSize(10);
    doc.text("ملاحظة: تم استخراج هذه البيانات آلياً عبر المنصة الجغرافية للديوان.", 105, 150, { align: "center" });

    // حفظ الملف
    doc.save(`Request_15_19_${formData.ownerName}.pdf`);
  };

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px', height: '100%', direction: 'rtl' }}>
      
      {/* الخريطة التفاعلية (2327 قطعة أرضية) */}
      <div style={{ flex: 2 }}>
        <h3 style={{ marginBottom: '10px' }}>المخطط العقاري الرقمي</h3>
        <MzabMap onParcelSelect={handleParcelSelect} />
      </div>

      {/* استمارة المرسوم 15-19 */}
      <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h3 style={{ color: '#d32f2f', borderBottom: '2px solid #eee' }}>بيانات التسوية</h3>
        
        <div style={{ marginTop: '20px' }}>
          <label>اسم صاحب الطلب:</label>
          <input 
            type="text" 
            style={{ width: '100%', padding: '8px', marginBottom: '15px' }} 
            onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
          />

          <label>القسم (آلي):</label>
          <input type="text" value={formData.section} readOnly style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#eee' }} />

          <label>المجموعة (آلي):</label>
          <input type="text" value={formData.ilot} readOnly style={{ width: '100%', padding: '8px', marginBottom: '20px', background: '#eee' }} />

          <button 
            onClick={generatePDF}
            style={{ width: '100%', padding: '12px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            طباعة استمارة المرسوم 15-19
          </button>
        </div>
      </div>
    </div>
  );
};

export default UrbanMap;