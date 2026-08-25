import React, { useState, useRef } from 'react';
import { MapPin, Hash, Layers, Ruler, UploadCloud, FileJson, CheckCircle } from 'lucide-react';

export default function UrbanMap() {
  const [importedData, setImportedData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // دالة قراءة وتفكيك ملف الـ JSON
  const handleFileUpload = (file) => {
    setError('');
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json') && !file.name.endsWith('.geojson')) {
      setError('الرجاء رفع ملف بصيغة JSON أو GeoJSON فقط.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);

        // استخراج البيانات: يدعم GeoJSON (أول قطعة) أو JSON مباشر
        let extractedData = {};
        if (json.type === 'FeatureCollection' && json.features?.length > 0) {
          extractedData = json.features[0].properties;
        } else if (json.type === 'Feature') {
          extractedData = json.properties;
        } else {
          extractedData = json;
        }

        setImportedData(extractedData);
      } catch (err) {
        setError('تعذرت قراءة الملف. تأكد من سلامة هيكلة الـ JSON.');
      }
    };
    reader.readAsText(file);
  };

  // دوال السحب والإفلات
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileUpload(files[0]);
  };

  return (
    <div className="flex flex-col xl:flex-row h-full w-full bg-gray-50 overflow-hidden" dir="rtl">

      {/* منطقة رفع الملف (اليسار) */}
      <div className="flex-grow h-[60vh] xl:h-full p-8 flex flex-col items-center justify-center relative">
        <div
          className={`w-full max-w-2xl h-96 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {importedData ? (
            <div className="flex flex-col items-center text-emerald-600 animate-in fade-in zoom-in duration-300">
              <CheckCircle size={64} className="mb-4" />
              <h3 className="text-2xl font-bold">تم استيراد البيانات بنجاح!</h3>
              <p className="text-gray-500 mt-2">البيانات جاهزة للاستخدام في عقود التعمير</p>
              <button
                onClick={() => setImportedData(null)}
                className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
              >
                استيراد ملف آخر
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-gray-500">
              <UploadCloud size={64} className={`mb-4 ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`} />
              <h3 className="text-xl font-bold text-gray-700 mb-2">اسحب وأفلت ملف الكداستر هنا</h3>
              <p className="text-sm text-gray-400 mb-6">أو انقر لاختيار ملف JSON / GeoJSON</p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e.target.files[0])}
                accept=".json,.geojson"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="flex items-center gap-2 bg-[#1e293b] hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-md"
              >
                <FileJson size={20} />
                تصفح الملفات
              </button>

              {error && <p className="text-red-500 mt-4 text-sm font-bold bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
            </div>
          )}
        </div>
      </div>

      {/* الشريط الجانبي: معلومات العقد (اليمين) */}
      <div className="w-full xl:w-[400px] h-full bg-white flex flex-col p-6 overflow-y-auto shadow-xl z-10 border-l border-gray-100">
        <div className="flex items-center justify-center mb-8 relative pt-2">
          <div className="absolute top-0 w-12 h-1 bg-emerald-600 rounded-full"></div>
          <h2 className="text-2xl font-bold text-gray-800 mt-3">بيانات القطعة الأرضية</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center text-center">
            <div className="text-blue-500 mb-2 bg-blue-50 p-2 rounded-full"><MapPin size={20} /></div>
            <span className="text-xs text-gray-500 mb-1">البلدية</span>
            <span className="text-base font-bold text-gray-800 w-full truncate" title={importedData?.commune}>
              {importedData ? (importedData.commune || importedData.nom_commune || 'غير متوفر') : '---'}
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center text-center">
            <div className="text-red-500 mb-2 bg-red-50 p-2 rounded-full"><Hash size={20} /></div>
            <span className="text-xs text-gray-500 mb-1">رقم القسم</span>
            <span className="text-base font-bold text-gray-800">
              {importedData ? (importedData.section || importedData.sec || '---') : '---'}
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center text-center">
            <div className="text-orange-500 mb-2 bg-orange-50 p-2 rounded-full"><Layers size={20} /></div>
            <span className="text-xs text-gray-500 mb-1">مجموعة الملكية</span>
            <span className="text-base font-bold text-gray-800">
              {importedData ? (importedData.groupe || importedData.ilot || '---') : '---'}
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center text-center">
            <div className="text-green-500 mb-2 bg-green-50 p-2 rounded-full"><Ruler size={20} /></div>
            <span className="text-xs text-gray-500 mb-1">المساحة (م²)</span>
            <span className="text-base font-bold text-gray-800">
              {importedData ? (importedData.surface || importedData.area || '---') : '---'}
            </span>
          </div>
        </div>

        {/* زر الطباعة أو الانتقال (يظهر فقط عند وجود بيانات) */}
        {importedData && (
          <button className="w-full mt-auto bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all transform hover:-translate-y-1">
            إدراج البيانات في عقد جديد
          </button>
        )}
      </div>

    </div>
  );
}