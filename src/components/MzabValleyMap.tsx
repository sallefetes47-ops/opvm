<MapContainer 
    center={[32.4845, 3.6792]} 
    zoom={15} 
    style={{ height: '600px', width: '100%' }}
>
    {/* استبدال OSM بصور الأقمار الصناعية من Esri */}
    <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
    />

    {geoJsonData && (
        <GeoJSON 
            data={geoJsonData} 
            style={{ color: '#FFD700', weight: 1.5, fillOpacity: 0.1 }} // تغيير اللون للأصفر ليكون أوضح فوق الساتليت
        />
    )}
</MapContainer>