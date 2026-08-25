import React, { useRef, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { Printer, Search } from 'lucide-react';

const CC15Template = React.forwardRef((props: any, ref: any) => {
  const { data } = props;

  return (
    <div ref={ref} className="p-[10mm] bg-white text-black w-[210mm] min-h-[297mm] relative text-[10pt] select-none font-sans" style={{ boxSizing: 'border-box' }}>
      {/* Outer Border */}
      <div className="border-2 border-black p-4 h-full min-h-[275mm] relative flex flex-col justify-between" style={{ outline: '1px solid black', outlineOffset: '2px' }}>
        
        {/* Margin Stamp */}
        <div className="absolute right-[-25px] top-1/2 -translate-y-1/2 rotate-90 origin-right text-[8pt] font-bold tracking-widest text-black uppercase">
          CC15 DELIVRE PAR FADAAELDHAZAIR
        </div>

        <div>
          {/* Header Section */}
          <table className="w-full border-collapse mb-6">
            <tbody>
              <tr>
                <td className="border border-black p-3 w-[55%] font-bold text-[10pt] align-top">
                  <div className="text-[11pt] mb-2 uppercase">DIRECTION GENERALE DU DOMAINE NATIONAL</div>
                  <div className="text-[9.5pt] font-normal leading-tight">
                    DIRECTION DU CADASTRE ET<br />
                    DE LA CONSERVATION FONCIERE<br />
                    DE LA WILAYA D <span className="font-bold text-[10.5pt]">GHARDAIA</span>
                  </div>
                </td>
                <td className="border border-black p-0 w-[45%] align-top">
                  <table className="w-full border-collapse text-[9.5pt]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-2 font-bold whitespace-nowrap">COMMUNE DE :</td>
                        <td className="p-2 text-right font-bold uppercase">{data?.commune || 'EL ATTEUF'}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-2 font-bold whitespace-nowrap">SECTION N° :</td>
                        <td className="p-2 text-right font-mono font-bold">{data?.section || '021'}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-2 font-bold whitespace-nowrap">ILOT N° :</td>
                        <td className="p-2 text-right font-mono font-bold">{data?.ilot || '0201'}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold whitespace-nowrap">ECHELLE :</td>
                        <td className="p-2 text-right font-mono font-bold">{data?.scale || '1:200'}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Document Title */}
          <h1 className="text-center text-[22pt] font-bold my-6 uppercase tracking-wider">
            EXTRAIT DU PLAN CADASTRAL
          </h1>

          {/* Map Plotting Area */}
          <div className="w-full h-[480px] border border-black relative mb-6 bg-white overflow-hidden">
            {/* North Arrow */}
            <div className="absolute top-4 right-5 text-center font-bold text-[14pt]">
              <div>N</div>
              <div className="w-[2px] h-12 bg-black mx-auto relative before:content-[''] before:absolute before:top-0 before:left-[-4px] before:w-0 before:h-0 before:border-l-[5px] before:border-l-transparent before:border-r-[5px] before:border-r-transparent before:border-b-[8px] before:border-b-black"></div>
            </div>

            {/* Coordinates */}
            <div className="absolute top-3 left-4 text-[8pt] font-mono leading-tight text-gray-800">
              X: 569726.672<br />Y: 3592580.143<br />+
            </div>
            <div className="absolute top-3 right-20 text-[8pt] font-mono text-right leading-tight text-gray-800">
              X: 569743.898<br />Y: 3592580.143<br />+
            </div>
            <div className="absolute bottom-3 left-4 text-[8pt] font-mono leading-tight text-gray-800">
              +<br />X: 569726.672<br />Y: 3592553.048
            </div>
            <div className="absolute bottom-3 right-20 text-[8pt] font-mono text-right leading-tight text-gray-800">
              +<br />X: 569743.898<br />Y: 3592553.048
            </div>

            {/* SVG Cadastral Plot */}
            <svg className="w-full h-full" viewBox="0 0 500 400">
              {/* Neighboring boundary line */}
              <line x1="90" y1="310" x2="390" y2="305" stroke="black" strokeWidth="2" />
              <line x1="90" y1="310" x2="95" y2="350" stroke="black" strokeWidth="1.5" />
              <line x1="390" y1="305" x2="395" y2="350" stroke="black" strokeWidth="1.5" />
              
              {/* Target Parcel Polygon */}
              <polygon points="170,75 375,72 380,305 175,310" fill="rgba(211, 47, 47, 0.05)" stroke="#d32f2f" strokeWidth="2.5" />
              
              {/* Parcel Labels */}
              <text x="270" y="180" fill="#d32f2f" className="font-bold text-[16pt]" textAnchor="middle">{data?.parcel || '201'}</text>
              <text x="270" y="198" fill="#d32f2f" className="text-[12pt] font-bold" textAnchor="middle">a</text>
              
              <text x="275" y="330" fill="black" className="font-bold text-[12pt]" textAnchor="middle">202</text>
            </svg>
          </div>

          {/* Legal & Certification Footer */}
          <div className="mt-4 text-[10pt] leading-relaxed">
            <div className="text-[#d32f2f] font-bold underline mb-2">NB: Le présent plan ne vaut pas titre de propriété.</div>
            <div className="my-1">Extrait certifié conforme au plan cadastral à la date du: <span className="font-bold">{data?.date || '13/07/2026'}</span></div>
            <div className="my-1">N° d'ordre du livre des recettes: <span className="font-bold font-mono ml-4">{data?.recetteNum || '43614/2026'}</span></div>
            <div className="mt-3">Demandé par: <span className="font-bold text-[11pt] uppercase">{data?.owner || 'HAMMOUALI HADJ DAOUD'}</span></div>
          </div>
        </div>

        {/* Bottom Content Row */}
        <div className="w-full flex items-end justify-between mt-6">
          {/* Simulated QR Code Box */}
          <div className="w-[90px] h-[90px] border-2 border-black p-1">
            <div className="w-full h-full bg-black opacity-90" style={{ 
              backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)', 
              backgroundSize: '10px 10px',
              backgroundColor: '#fff'
            }}></div>
          </div>

          {/* Contenance Table */}
          <table className="w-[280px] border-collapse border border-black text-[9.5pt]">
            <thead>
              <tr className="bg-gray-100">
                <th colSpan={4} className="border border-black p-1.5 text-center font-bold">Contenance</th>
              </tr>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 text-center font-bold">N°Ilot</th>
                <th className="border border-black p-1 text-center font-bold">Ha</th>
                <th className="border border-black p-1 text-center font-bold">Are</th>
                <th className="border border-black p-1 text-center font-bold">Ca</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold text-center">
                <td className="border border-black p-1.5 font-mono">{data?.contenance?.ilot || '0201'}</td>
                <td className="border border-black p-1.5 font-mono">{data?.contenance?.ha || '0000'}</td>
                <td className="border border-black p-1.5 font-mono">{data?.contenance?.are || '02'}</td>
                <td className="border border-black p-1.5 font-mono">{data?.contenance?.ca || '53'}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
});

export default function CadastralSearchAndPrint() {
  const [commune, setCommune] = useState('EL ATTEUF');
  const [section, setSection] = useState('021');
  const [ilot, setIlot] = useState('0201');
  const [hasSearched, setHasSearched] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const componentRef = useRef<HTMLDivElement>(null);

  const mockData = {
    commune,
    section,
    ilot,
    scale: '1:200',
    date: '16/07/2026',
    recetteNum: '43614/2026',
    owner: 'HAMMOUALI HADJ DAOUD',
    parcel: '201',
    contenance: { ilot: ilot, ha: '0000', are: '02', ca: '53' }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (section && ilot) {
      setHasSearched(true);
    }
  };

  const handlePrintPDF = async () => {
    const element = componentRef.current;
    if (!element) return;
    
    setIsGenerating(true);
    
    try {
      const options = {
        margin: 0,
        filename: `Extrait_Plan_Cadastral_${section}_${ilot}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
          scale: 3, 
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(options).from(element).save();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8 print:hidden">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Search className="text-blue-600" /> Recherche Extrait du Plan Cadastral (CC15)
        </h3>
        
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Commune</label>
            <input 
              type="text" 
              value={commune} 
              onChange={(e) => setCommune(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase"
              placeholder="e.g. EL ATTEUF"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section N°</label>
            <input 
              type="text" 
              value={section} 
              onChange={(e) => setSection(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="021"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ilot N°</label>
            <input 
              type="text" 
              value={ilot} 
              onChange={(e) => setIlot(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-4 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="0201"
            />
          </div>
          <div className="md:col-span-3 flex justify-end mt-2">
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-8 py-2.5 rounded-md font-semibold hover:bg-blue-700 transition shadow-sm"
            >
              Rechercher
            </button>
          </div>
        </form>
      </div>

      {hasSearched && (
        <div className="animation-fade-in">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <h2 className="text-lg font-semibold text-gray-700">Aperçu du Document</h2>
            <button 
              onClick={handlePrintPDF} 
              disabled={isGenerating}
              className={`flex items-center gap-2 text-white font-bold py-2.5 px-6 rounded-md shadow transition ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <Printer size={20} />
              {isGenerating ? 'Génération du PDF...' : 'Télécharger le PDF'}
            </button>
          </div>

          <div className="bg-gray-200 p-8 rounded-lg overflow-auto flex justify-center border border-gray-300 shadow-inner">
            <CC15Template ref={componentRef} data={mockData} />
          </div>
        </div>
      )}
    </div>
  );
}
