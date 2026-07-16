import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, FileText } from 'lucide-react';

// 1. المكون المخصص لشكل الوثيقة الرسمية (Print Template)
const CadastralPrintTemplate = React.forwardRef((props: any, ref: any) => {
  const { data } = props; // يمكنك تمرير بيانات العقد ديناميكياً هنا

  return (
    <div ref={ref} className="p-[10mm] bg-white text-black font-sans text-[10pt] leading-tight select-none print:p-0">
      {/* الإطار الخارجي للوثيقة الرسمية */}
      <div className="border-2 border-black p-4 w-full relative min-h-[275mm]">
        
        {/* النص الجانبي العمودي التوثيقي */}
        <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 rotate-90 origin-right text-[8pt] font-bold tracking-widest text-gray-600">
          CC15 DELIVRE PAR SYSTEME OPVM
        </div>

        {/* الهيدر العلوي */}
        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <td className="border border-black p-2 w-[55%] font-bold text-[10pt]">
                <div className="text-[11pt] mb-1">DIRECTION GENERALE DU DOMAINE NATIONAL</div>
                <div className="text-[9.5pt] font-normal">
                  DIRECTION DU CADASTRE ET<br />
                  DE LA CONSERVATION FONCIERE<br />
                  DE LA WILAYA DE <span className="font-bold text-[10.5pt]">GHARDAIA</span>
                </div>
              </td>
              <td className="border border-black p-0 w-[45%]">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-black"><td className="p-1 px-2 font-bold">COMMUNE DE : <span className="float-right font-bold">{data?.commune || 'EL ATTEUF'}</span></td></tr>
                    <tr className="border-b border-black"><td className="p-1 px-2 font-bold">SECTION N° : <span className="float-right font-bold">{data?.section || '021'}</span></td></tr>
                    <tr className="border-b border-black"><td className="p-1 px-2 font-bold">ILOT N° : <span className="float-right font-bold">{data?.ilot || '0201'}</span></td></tr>
                    <tr><td className="p-1 px-2 font-bold">ECHELLE : <span className="float-right font-bold">1:200</span></td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* عنوان الوثيقة */}
        <h1 className="text-center text-[20pt] font-bold my-6 uppercase tracking-wider">
          Extrait du Plan Cadastral
        </h1>

        {/* مساحة المخطط الهندسي */}
        <div className="w-full h-[480px] border border-black relative mb-6 bg-white overflow-hidden">
          {/* سهم الشمال */}
          <div className="absolute top-4 right-5 text-center font-bold text-[12pt]">
            <div>N</div>
            <div className="w-[2px] h-10 bg-black mx-auto relative before:content-[''] before:absolute before:top-0 before:left-[-4px] before:w-0 before:h-0 before:border-l-[5px] before:border-l-transparent before:border-r-[5px] before:border-r-transparent before:border-b-[8px] before:border-b-black"></div>
          </div>

          {/* نقاط الإحداثيات الطرفية */}
          <div className="absolute top-2 left-3 text-[7.5pt] font-mono text-gray-700">X: 569726.672<br />Y: 3592580.143<br />+</div>
          <div className="absolute top-2 right-20 text-[7.5pt] font-mono text-gray-700 text-right">X: 569743.898<br />Y: 3592580.143<br />+</div>
          <div className="absolute bottom-2 left-3 text-[7.5pt] font-mono text-gray-700">+<br />X: 569726.672<br />Y: 3592553.048</div>
          <div className="absolute bottom-2 right-20 text-[7.5pt] font-mono text-gray-700 text-right">+<br />X: 569743.898<br />Y: 3592553.048</div>

          {/* المخطط الهندسي المرسوم (SVG) */}
          <svg className="w-full h-full" viewBox="0 0 500 400">
            <line x1="100" y1="310" x2="380" y2="305" stroke="black" strokeWidth="2" />
            <line x1="100" y1="310" x2="102" y2="350" stroke="black" strokeWidth="1.5" />
            <line x1="380" y1="305" x2="382" y2="350" stroke="black" strokeWidth="1.5" />
            {/* حدود القطعة الحمراء */}
            <polygon points="170,75 375,72 380,305 175,310" fill="none" stroke="#d32f2f" strokeWidth="2.5" />
            <text x="270" y="185" fill="#d32f2f" className="font-bold text-[14pt]" textAnchor="middle">{data?.parcelNum || '201'}</text>
            <text x="270" y="202" fill="#d32f2f" className="text-[10pt]" textAnchor="middle">a</text>
            <text x="275" y="325" fill="black" className="font-bold text-[10pt]" textAnchor="middle">202</text>
          </svg>
        </div>

        {/* معلومات التوثيق والاعتماد */}
        <div className="mt-4 text-[9.5pt]">
          <div className="text-red-600 font-bold underline mb-1">NB : Le présent plan ne vaut pas titre de propriété.</div>
          <div className="my-1">Extrait certifié conforme au plan cadastral à la date du : <span className="font-bold">{data?.date || '16/07/2026'}</span></div>
          <div className="my-1">N° d'ordre du livre des recettes : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="font-bold">{data?.recetteNum || '43614/2026'}</span></div>
          <div className="mt-2">Demandé par : <span className="font-bold text-[11pt]">{data?.owner || 'HAMMOUALI HADJ DAOUD'}</span></div>
        </div>

        {/* المربع السفلي: جدول المساحات و QR Code */}
        <div className="w-full flex items-end justify-between mt-6">
          {/* محاكاة الـ QR Code */}
          <div className="w-[90px] h-[90px] border-2 border-black p-1">
            <div className="w-full h-full bg-slate-800 opacity-90" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)', backgroundSize: '8px 8px' }}></div>
          </div>

          {/* جدول المساحة */}
          <table className="w-[280px] border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th colSpan={4} className="border border-black p-1 text-center font-bold text-[9pt]">Contenance</th>
              </tr>
              <tr className="bg-gray-50 text-[9pt]">
                <th className="border border-black p-1 text-center">N° Ilot</th>
                <th className="border border-black p-1 text-center">Ha</th>
                <th className="border border-black p-1 text-center">Are</th>
                <th className="border border-black p-1 text-center">Ca</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-[9pt] font-bold text-center">
                <td className="border border-black p-1">{data?.ilot || '0201'}</td>
                <td className="border border-black p-1">0000</td>
                <td className="border border-black p-1">02</td>
                <td className="border border-black p-1">53</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
});

// 2. المكون الأساسي لزر الطباعة (الذي يظهر في لوحة التحكم)
export default function ContractDetailsCard({ contractData }: { contractData: any }) {
  const componentRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Extrait_Plan_Cadastral_${contractData?.owner || 'Contract'}`,
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="text-emerald-600" /> تفاصيل عقد التعمير
        </h3>
        
        {/* زر الطباعة المباشر */}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          <Printer size={18} />
          طباعة وثيقة مسح الأراضي
        </button>
      </div>

      {/* حقل المعاينة المخفي المخصص للطباعة فقط */}
      <div className="hidden">
        <CadastralPrintTemplate ref={componentRef} data={contractData} />
      </div>
      
      {/* باقي تفاصيل العقد هنا في لوحة التحكم... */}
      <p className="text-sm text-gray-500">اضغط على الزر أعلاه لتوليد المخطط العقاري بصيغة قابلة للطباعة مباشرة عبر المتصفح.</p>
    </div>
  );
}
