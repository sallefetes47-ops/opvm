import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import { MapPin, Hash, Layers, Ruler, Search, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.vectorgrid'; // تأكد من تشغيل: npm install leaflet.vectorgrid

// 1. المحرك الحي: يقرأ بيانات الكداستر مباشرة من فضاء الجزائر
const EspaceAlgerieMvtLayer = ({ onFeatureClick }) => {
  const map = useMap();

  useEffect(() => {
    // هذا هو الرابط الديناميكي (MVT) الذي يسحب البيانات بصيغة بلاطات
    // قمنا بوضع رابط تجريبي/افتراضي هنا (يجب تغييره للرابط الفعلي الذي التقطناه بالرادار)
    const mvtUrl = "https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/{z}/{x}/{y}.mvt";

    const vectorLayer = L.vectorGrid.protobuf(mvtUrl, {
      vectorTileLayerStyles: {
        // تنسيق مضلعات الأراضي
        default: {
          weight: 1.5,
          color: '#eab308',
          fillColor: '#fef08a',
          fillOpacity: 0.3,
          fill: true
        }
      },
      interactive: true
    });

    vectorLayer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (e.layer.properties) {
        onFeatureClick(e.layer.properties); // تمرير البيانات للشريط الجانبي
      }
    });

    vectorLayer.addTo(map);

    return () => {
      map.removeLayer(vectorLayer);
    };
  }, [map, onFeatureClick]);

  return null;
};

// 2. الواجهة الرئيسية للخريطة العمرانية
export default function UrbanMap() {
  const [selectedProperty, setSelectedProperty] = useState(null);

  return (
    <div className="flex flex-col xl:flex-row h-full w-full bg-gray-50 overflow-hidden" dir="rtl">

      {/* الشريط الجانبي الأيمن */}
      <div className="w-full xl:w-[400px] h-full bg-white flex flex-col p-4 overflow-y-auto shadow-lg z-10 border-l border-gray-100">
        <div className="bg-white rounded-xl mb-6">
          <div className="flex items-center justify-center mb-6 relative pt-2">
            <div className="absolute top-0 w-12 h-1 bg-[#1e293b] rounded-full"></div>
            <h2 className="text-xl font-bold text-[#1e293b] mt-3">معلومات المسح العقاري</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-blue-50/70 rounded-xl p-3 border border-blue-100 flex flex-col items-center text-center">
              <div className="text-blue-500 mb-1"><MapPin size={18} /></div>
              <span className="text-xs text-gray-500">البلدية</span>
              <span className="text-sm font-bold text-gray-800 truncate w-full">{selectedProperty?.commune || '---'}</span>
            </div>

            <div className="bg-red-50/70 rounded-xl p-3 border border-red-100 flex flex-col items-center text-center">
              <div className="text-red-500 mb-1"><Hash size={18} /></div>
              <span className="text-xs text-gray-500">رقم القسم</span>
              <span className="text-sm font-bold text-gray-800">{selectedProperty?.section || '---'}</span>
            </div>

            <div className="bg-orange-50/70 rounded-xl p-3 border border-orange-100 flex flex-col items-center text-center">
              <div className="text-orange-500 mb-1"><Layers size={18} /></div>
              <span className="text-xs text-gray-500">مجموعة الملكية</span>
              <span className="text-sm font-bold text-gray-800">{selectedProperty?.groupe || '---'}</span>
            </div>

            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-200 flex flex-col items-center text-center">
              <div className="text-gray-500 mb-1"><RefreshCw size={18} /></div>
              <span className="text-xs text-gray-500">الحالة</span>
              <span className={`text-sm font-bold ${selectedProperty ? 'text-green-600' : 'text-gray-800'}`}>
                {selectedProperty ? 'محددة' : 'بانتظار الاختيار'}
              </span>
            </div>

            <div className="bg-green-50/70 rounded-xl p-3 border border-green-100 flex flex-col items-center text-center col-span-2">
              <div className="text-green-500 mb-1"><Ruler size={18} /></div>
              <span className="text-xs text-gray-500">المساحة الإجمالية (م²)</span>
              <span className="text-sm font-bold text-gray-800">{selectedProperty?.surface || '---'}</span>
            </div>
          </div>
        </div>

        {/* نافذة البحث الذكي */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mt-auto">
          <div className="flex items-center gap-2 mb-4">
            <Search className="text-gray-500" size={18} />
            <h3 className="text-md font-bold text-gray-800">البحث الذكي</h3>
          </div>
          <div className="flex flex-col gap-3">
            <input type="text" placeholder="رقم القسم (3 أرقام)" className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-700" />
            <input type="text" placeholder="مجموعة الملكية (4 أرقام)" className="w-full p-2.5 border border-gray-300 rounded-lg text-gray-700" />
            <button className="w-full bg-[#1e293b] hover:bg-gray-800 text-white py-3 mt-2 rounded-lg font-bold flex items-center justify-center gap-2">
              <Search size={18} />
              بحث
            </button>
          </div>
        </div>
      </div>

      {/* منطقة الخريطة */}
      <div className="relative flex-grow h-[60vh] xl:h-full z-0">
        <MapContainer
          center={[32.49, 3.67]} // إحداثيات ولاية غرداية
          zoom={12}
          className="w-full h-full"
          zoomControl={true}
        >
          {/* طبقات القمر الصناعي والخرائط */}
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="خريطة الشارع (OSM)">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="جوجل إيرث هجين (Hybrid)">
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* استدعاء محرك الكداستر الذي سيقرأ البيانات ويرسلها للشريط الجانبي */}
          <EspaceAlgerieMvtLayer onFeatureClick={(properties) => setSelectedProperty(properties)} />

        </MapContainer>
      </div>
    </div>
  );
}