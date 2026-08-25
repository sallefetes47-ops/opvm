import React from 'react';

const TRANSLATE_MUNICIPALITY: Record<string, string> = {
  'غرداية': 'GHARDAIA',
  'العطف': 'EL ATTEUF',
  'بنورة': 'BOUNOURA',
  'الضاية': 'DAYA',
  'متليلي': 'METLILI'
};

export const CC15Template = React.forwardRef(({ data }: { data: any }, ref: any) => {
  const communeFr = TRANSLATE_MUNICIPALITY[data.municipality] || data.municipality || 'EL ATTEUF';
  const section = data.section || '---';
  const ilot = data.propertyGroup || '---';
  
  const realArea = data.actualArea ? `${data.actualArea} m²` : '---';
  const surveyArea = data.cadastralArea ? `${data.cadastralArea} m²` : '---';

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // Dynamic Map Labels
  const ilotNum = parseInt(ilot, 10);
  const mainParcel = isNaN(ilotNum) ? ilot : ilotNum.toString();
  const neighborParcel = isNaN(ilotNum) ? '---' : (ilotNum + 1).toString();

  // Coordinate Projection Helper (UTM -> SVG Space)
  const svgWidth = 500;
  const svgHeight = 400;

  let geoCoords = data.coordinates;
  // Fallback to a deterministic mock tilted polygon if no actual GIS geometry is provided
  if (!geoCoords || geoCoords.length === 0) {
    let hash = 0;
    const str = `${section}-${ilot}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const baseX = 569000 + (Math.abs(hash) % 1000);
    const baseY = 3592000 + (Math.abs(hash) % 1000);
    geoCoords = [
      { x: baseX + 2, y: baseY + 20 },
      { x: baseX + 18, y: baseY + 25 },
      { x: baseX + 22, y: baseY + 5 },
      { x: baseX + 5, y: baseY + 2 },
    ];
  }

  // 1. Find Bounding Box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  geoCoords.forEach((p: { x: number; y: number }) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  // 2. Add 20% padding
  const paddedMinX = minX - (width * 0.2);
  const paddedMaxX = maxX + (width * 0.2);
  const paddedMinY = minY - (height * 0.2);
  const paddedMaxY = maxY + (height * 0.2);

  const viewWidth = paddedMaxX - paddedMinX;
  const viewHeight = paddedMaxY - paddedMinY;

  // 3. Preserve aspect ratio to prevent stretching
  const scale = Math.min(svgWidth / viewWidth, svgHeight / viewHeight);
  const xOffset = (svgWidth - (viewWidth * scale)) / 2;
  const yOffset = (svgHeight - (viewHeight * scale)) / 2;

  // 4. Project coordinates to SVG pixels (Invert Y)
  const projectedCoords = geoCoords.map((p: { x: number; y: number }) => {
    const px = xOffset + ((p.x - paddedMinX) * scale);
    const py = svgHeight - (yOffset + ((p.y - paddedMinY) * scale));
    return { x: px, y: py };
  });

  const pointsString = projectedCoords.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ');

  // 5. Calculate Centroid for placing text labels
  let centroidX = 0, centroidY = 0;
  projectedCoords.forEach((p: { x: number; y: number }) => {
    centroidX += p.x;
    centroidY += p.y;
  });
  centroidX /= projectedCoords.length;
  centroidY /= projectedCoords.length;

  // Corner labels matching the geographic bounds of the padded viewport
  const tlX = paddedMinX.toFixed(3);
  const tlY = paddedMaxY.toFixed(3); // Geographic Top is Max Y
  const trX = paddedMaxX.toFixed(3);
  const blY = paddedMinY.toFixed(3); // Geographic Bottom is Min Y

  // Dynamic Contenance (Ha, Are, Ca)
  let ha = '0000';
  let are = '00';
  let ca = '00';
  if (data.cadastralArea) {
    const area = Math.round(Number(data.cadastralArea));
    ha = String(Math.floor(area / 10000)).padStart(4, '0');
    are = String(Math.floor((area % 10000) / 100)).padStart(2, '0');
    ca = String(area % 100).padStart(2, '0');
  }

  return (
    <div ref={ref} className="p-[10mm] bg-white text-black w-[210mm] min-h-[297mm] relative text-[10pt] select-none font-sans" style={{ boxSizing: 'border-box' }}>
      {/* Outer Border */}
      <div className="border-2 border-black p-4 h-full min-h-[275mm] relative flex flex-col justify-between" style={{ outline: '1px solid black', outlineOffset: '2px' }}>
        
        {/* Margin Stamp */}
        <div className="absolute right-[-25px] top-1/2 -translate-y-1/2 rotate-90 origin-right text-[8pt] font-bold tracking-widest text-black uppercase whitespace-nowrap">
          CC15 DELIVRE PAR SYSTEME CADASTRAL
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
                        <td className="p-2 text-right font-bold uppercase">{communeFr}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-2 font-bold whitespace-nowrap">SECTION N° :</td>
                        <td className="p-2 text-right font-mono font-bold">{section}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-2 font-bold whitespace-nowrap">ILOT N° :</td>
                        <td className="p-2 text-right font-mono font-bold">{ilot}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold whitespace-nowrap">ECHELLE :</td>
                        <td className="p-2 text-right font-mono font-bold">1:200</td>
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
              X: {tlX}<br />Y: {tlY}<br />+
            </div>
            <div className="absolute top-3 right-20 text-[8pt] font-mono text-right leading-tight text-gray-800">
              X: {trX}<br />Y: {tlY}<br />+
            </div>
            <div className="absolute bottom-3 left-4 text-[8pt] font-mono leading-tight text-gray-800">
              +<br />X: {tlX}<br />Y: {blY}
            </div>
            <div className="absolute bottom-3 right-20 text-[8pt] font-mono text-right leading-tight text-gray-800">
              +<br />X: {trX}<br />Y: {blY}
            </div>

            {/* SVG Cadastral Plot */}
            <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
              {/* Main Projected Polygon */}
              <polygon points={pointsString} fill="rgba(211, 47, 47, 0.05)" stroke="#d32f2f" strokeWidth="2.5" />
              
              {/* Dynamic Centroid Labels */}
              <text x={centroidX} y={centroidY} fill="#d32f2f" className="font-bold text-[16pt]" textAnchor="middle">{mainParcel}</text>
              <text x={centroidX} y={centroidY + 18} fill="#d32f2f" className="text-[12pt] font-bold" textAnchor="middle">a</text>
            </svg>
          </div>

          {/* Legal & Certification Footer */}
          <div className="mt-4 text-[10pt] leading-relaxed">
            <div className="text-[#d32f2f] font-bold underline mb-2">NB: Le présent plan ne vaut pas titre de propriété.</div>
            <div className="my-1">Extrait certifié conforme au plan cadastral à la date du: <span className="font-bold">{dateStr}</span></div>
            <div className="my-1">N° d'ordre du livre des recettes: <span className="font-bold font-mono ml-4">...... / {now.getFullYear()}</span></div>
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
          <div className="w-[320px]">
            <table className="w-full border-collapse border border-black text-[9pt] mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th colSpan={4} className="border border-black p-1 text-center font-bold">Contenance</th>
                </tr>
                <tr className="bg-gray-50 text-[8.5pt]">
                  <th className="border border-black p-1 text-center font-bold">N°Ilot</th>
                  <th className="border border-black p-1 text-center font-bold">Ha</th>
                  <th className="border border-black p-1 text-center font-bold">Are</th>
                  <th className="border border-black p-1 text-center font-bold">Ca</th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-bold text-center">
                  <td className="border border-black p-1 font-mono">{ilot}</td>
                  <td className="border border-black p-1 font-mono">{ha}</td>
                  <td className="border border-black p-1 font-mono">{are}</td>
                  <td className="border border-black p-1 font-mono">{ca}</td>
                </tr>
              </tbody>
            </table>
            
            <table className="w-full border-collapse border border-black text-[8.5pt]">
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-bold w-[60%]">Surface Réelle</td>
                  <td className="border border-black p-1 text-right font-mono w-[40%]">{realArea}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
});
