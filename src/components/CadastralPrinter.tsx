import React, { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { Printer, Search, FileText } from 'lucide-react';

export default function CadastralPrinter() {
  // مدخلات البحث الذكي
  const [commune, setCommune] = useState('EL ATTEUF');
  const [section, setSection] = useState('021');
  const [ilot, setIlot] = useState('0201');
  const [hasSearched, setHasSearched] = useState(false);

  // مرجع عنصر وثيقة المخطط العقاري
  const reportTemplateRef = useRef<HTMLDivElement>(null);

  // بيانات افتراضية تطابق الملف المرفق بدقة
  const [data, setData] = useState({
    wilaya: 'GHARDAIA',
    commune: 'EL ATTEUF',
    section: '021',
    ilot: '0201',
    scale: '1:200',
    date: '13/07/2026',
    recetteNum: '43614/2026',
    owner: 'HAMMOUALI HADJ DAOUD',
    contenance: { ilot: '0201', ha: '0000', are: '02', ca: '53' }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // هنا يتم جلب البيانات من قاعدة البيانات المحلية بناءً على (section و ilot)
    // لمحاكاة البحث، سنقوم بتفعيل العرض مباشرة:
    setHasSearched(true);
  };

  // دالة توليد وتحميل الـ PDF بدون تشويه للغة العربية وبدقة عالية جداً
  const handleDownloadPDF = () => {
    const element = reportTemplateRef.current;
    if (!element) return;

    const options = {
      margin: [10, 10, 10, 10], // الهوامش بالمليمتر
      filename: `Extrait_Plan_Cadastral_${section}_${ilot}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 3, // تكبير الدقة لمنع البكسلة (High Resolution)
        useCORS: true, 
        letterRendering: true 
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // تنفيذ التوليد المباشر والتحميل
    html2pdf().set(options).from(element).save();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans">
      
      {/* 1. نافذة البحث الذكي */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8 print:hidden">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Search className="text-emerald-600" /> نافذة البحث الذكي (عقود التعمير ومسح الأراضي)
        </h3>
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البلدية</label>
            <input 
              type="text" 
              value={commune} 
              onChange={(e) => setCommune(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-right"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم القسم</label>
            <input 
              type="text" 
              value={section} 
              onChange={(e) => setSection(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-right font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مجموعة الملكية / الجزيرة</label>
            <input 
              type="text" 
              value={ilot} 
              onChange={(e) => setIlot(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-right font-mono"
            />
          </div>
          <div className="md:col-span-3 flex justify-end gap-2 mt-4">
            <button 
              type="submit" 
              className="bg-emerald-600 text-white px-6 py-2 rounded font-semibold hover:bg-emerald-700 transition"
            >
              بحث في المسح العقاري
            </button>
          </div>
        </form>
      </div>

      {hasSearched && (
        <>
          {/* زر التوليد والطباعة المباشرة */}
          <div className="flex justify-end mb-4 print:hidden">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded shadow transition"
            >
              <Printer size={20} />
              تحميل المخطط بصيغة PDF (توليد رسمي)
            </button>
          </div>

          {/* 2. تصميم وثيقة المخطط العقاري المطابق للـ PDF المرفق */}
          <div className="bg-gray-100 p-4 rounded overflow-auto flex justify-center border border-gray-300">
            
            <div 
              ref={reportTemplateRef} 
              className="bg-white text-black p-[12mm] w-[210mm] min-h-[297mm] shadow-lg relative leading-snug text-[10pt] select-none"
              style={{ fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}
            >
              {/* الإطار الخارجي الأسود */}
              <div className="border-2 border-black p-4 h-full relative min-h-[270mm] flex flex-col justify-between">
                
                {/* التوقيع الجانبي العمودي */}
                <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 rotate-90 origin-right text-[8pt] font-bold tracking-widest text-gray-700">
                  {data.contenance.ilot === '0201' ? 'CC15 DELIVRE PAR FADAAELDHAZAIR' : 'CC15 DELIVRE PAR SYSTEME OPVM'}
                </div>

                <div>
                  {/* الهيدر العلوي */}
                  <table className="w-full border-collapse mb-6">
                    <tbody>
                      <tr>
                        <td className="border border-black p-3 w-[55%] font-bold text-[10pt] align-top text-left">
                          <div className="text-[11pt] mb-1">DIRECTION GENERALE DU DOMAINE NATIONAL</div>
                          <div className="text-[9.5pt] font-normal leading-normal">
                            DIRECTION DU CADASTRE ET<br />
                            DE LA CONSERVATION FONCIERE<br />
                            DE LA WILAYA DE <span className="font-bold text-[10.5pt]">GHARDAIA</span>
                          </div>
                        </td>
                        <td className="border border-black p-0 w-[45%] align-top">
                          <table className="w-full border-collapse">
                            <tbody>
                              <tr className="border-b border-black"><td className="p-2 px-3 font-bold text-left">COMMUNE DE : <span className="float-right">{commune}</span></td></tr>
                              <tr className="border-b border-black"><td className="p-2 px-3 font-bold text-left">SECTION N° : <span className="float-right font-mono">{section}</span></td></tr>
                              <tr className="border-b border-black"><td className="p-2 px-3 font-bold text-left">ILOT N° : <span className="float-right font-mono">{ilot}</span></td></tr>
                              <tr><td className="p-2 px-3 font-bold text-left">ECHELLE : <span className="float-right font-mono">{data.scale}</span></td></tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* العنوان الرئيسي للوثيقة */}
                  <h1 className="text-center text-[19pt] font-bold my-6 uppercase tracking-wider text-black">
                    Extrait du Plan Cadastral
                  </h1>

                  {/* لوحة المخطط الهندسي */}
                  <div className="w-full h-[470px] border border-black relative mb-6 bg-white overflow-hidden">
                    {/* سهم اتجاه الشمال */}
                    <div className="absolute top-4 right-5 text-center font-bold text-[12pt]">
                      <div>N</div>
                      <div className="w-[2px] h-10 bg-black mx-auto relative before:content-[''] before:absolute before:top-0 before:left-[-4px] before:w-0 before:h-0 before:border-l-[5px] before:border-l-transparent before:border-r-[5px] before:border-r-transparent before:border-b-[8px] before:border-b-black"></div>
                    </div>

                    {/* الإحداثيات الرسمية المطابقة بدقة للملف المرفق */}
                    <div className="absolute top-3 left-4 text-[7.5pt] font-mono text-gray-800 leading-tight">
                      X: 569726.672<br />Y: 3592580.143<br />+
                    </div>
                    <div className="absolute top-3 right-20 text-[7.5pt] font-mono text-gray-800 text-right leading-tight">
                      X: 569743.898<br />Y: 3592580.143<br />+
                    </div>
                    <div className="absolute bottom-3 left-4 text-[7.5pt] font-mono text-gray-800 leading-tight">
                      +<br />X: 569726.672<br />Y: 3592553.048
                    </div>
                    <div className="absolute bottom-3 right-20 text-[7.5pt] font-mono text-gray-800 text-right leading-tight">
                      +<br />X: 569743.898<br />Y: 3592553.048
                    </div>

                    {/* المخطط العقاري الجغرافي المسحوب (رسم متجهي SVG مطابق تماماً) */}
                    <svg className="w-full h-full" viewBox="0 0 500 400">
                      <line x1="100" y1="310" x2="380" y2="305" stroke="black" strokeWidth="2" />
                      <line x1="100" y1="310" x2="102" y2="350" stroke="black" strokeWidth="1.5" />
                      <line x1="380" y1="305" x2="382" y2="350" stroke="black" strokeWidth="1.5" />
                      
                      {/* المضلع المحدد للقطعة 201 بالخط الأحمر كما بالصورة المرفقة */}
                      <polygon points="170,75 375,72 380,305 175,310" fill="none" stroke="#d32f2f" strokeWidth="2.5" />
                      
                      {/* تسمية القطعة المستهدفة باللون الأحمر */}
                      <text x="270" y="180" fill="#d32f2f" className="font-bold text-[14pt]" textAnchor="middle">201</text>
                      <text x="270" y="196" fill="#d32f2f" className="text-[10pt]" textAnchor="middle">a</text>
                      
                      {/* تسمية القطعة المجاورة */}
                      <text x="275" y="325" fill="black" className="font-bold text-[10pt]" textAnchor="middle">202</text>
                    </svg>
                  </div>

                  {/* الملاحظات والتصديق الإداري */}
                  <div className="mt-4 text-[9.5pt]">
                    <div className="text-red-600 font-bold underline mb-1">NB : Le présent plan ne vaut pas titre de propriété.</div>
                    <div className="my-1">Extrait certifié conforme au plan cadastral à la date du : <span className="font-bold">{data.date}</span></div>
                    <div className="my-1">N° d'ordre du livre des recettes : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="font-bold font-mono">{data.recetteNum}</span></div>
                    <div className="mt-3">Demandé par : <span className="font-bold text-[11pt]">{data.owner}</span></div>
                  </div>
                </div>

                {/* الجزء السفلي: الرمز السري وجدول المساحات */}
                <div className="w-full flex items-end justify-between mt-4">
                  {/* مربع الـ QR Code التوثيقي */}
                  <div className="w-[90px] h-[90px] border-2 border-black p-1">
                    <div className="w-full h-full bg-black" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)', backgroundSize: '8px 8px' }}></div>
                  </div>

                  {/* جدول المساحات (Contenance) */}
                  <table className="w-[280px] border-collapse border border-black text-[9pt]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th colSpan={4} className="border border-black p-1 text-center font-bold">Contenance</th>
                      </tr>
                      <tr className="bg-gray-50">
                        <th className="border border-black p-1 text-center font-bold">N° Ilot</th>
                        <th className="border border-black p-1 text-center font-bold">Ha</th>
                        <th className="border border-black p-1 text-center font-bold">Are</th>
                        <th className="border border-black p-1 text-center font-bold">Ca</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-bold text-center">
                        <td className="border border-black p-1 font-mono">{data.contenance.ilot}</td>
                        <td className="border border-black p-1 font-mono">{data.contenance.ha}</td>
                        <td className="border border-black p-1 font-mono text-red-600">{data.contenance.are}</td>
                        <td className="border border-black p-1 font-mono text-red-600">{data.contenance.ca}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
