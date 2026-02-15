import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Layers, Search, MapPin } from 'lucide-react';

const mapContainerStyle = {
    width: '100%',
    height: '500px',
    borderRadius: '8px'
};

const center = {
    lat: 32.4860,
    lng: 3.6700
};

const mzabCities = [
    { name: "غرداية (Ghardaïa)", pos: { lat: 32.4860, lng: 3.6700 } },
    { name: "بني يزقن (Beni Isguen)", pos: { lat: 32.4760, lng: 3.6780 } },
    { name: "مليكة (Melika)", pos: { lat: 32.4890, lng: 3.6810 } },
    { name: "بونورة (Bounoura)", pos: { lat: 32.4810, lng: 3.6920 } },
    { name: "العاطف (El Atteuf)", pos: { lat: 32.4740, lng: 3.7480 } },
];

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export default function MapSelector() {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        libraries
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [mapType, setMapType] = useState<google.maps.MapTypeId>(google.maps.MapTypeId.SATELLITE);
    const [markerPos, setMarkerPos] = useState(center);
    const [address, setAddress] = useState("");
    const [showCadastre, setShowCadastre] = useState(false);
    const [showTopography, setShowTopography] = useState(false);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    const toggleMapType = () => {
        const newType = mapType === google.maps.MapTypeId.ROADMAP
            ? google.maps.MapTypeId.SATELLITE
            : google.maps.MapTypeId.ROADMAP;
        setMapType(newType);
        if (map) {
            map.setMapTypeId(newType);
        }
    };

    const onMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            setMarkerPos({
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
            });
        }
    };

    const onPlaceChanged = () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
            const newPos = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            };
            setMarkerPos(newPos);
            setAddress(place.formatted_address || "");
            if (map) {
                map.panTo(newPos);
                map.setZoom(15);
            }
        }
    };

    const goToCity = (pos: { lat: number, lng: number }) => {
        if (map) {
            map.panTo(pos);
            map.setZoom(15);
            setMarkerPos(pos);
        }
    };

    if (loadError) {
        return <div>خطأ في تحميل الخريطة. يرجى التأكد من الـ API Key.</div>;
    }

    if (!isLoaded) {
        return <div>جاري تحميل الخريطة...</div>;
    }

    return (
        <Card className="w-full max-w-5xl mx-auto shadow-xl">
            <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapIcon className="w-6 h-6 text-primary" />
                        <span>النسيج العمراني والمسح العقاري - سهل وادي ميزاب</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                        {mzabCities.map(city => (
                            <Button key={city.name} variant="ghost" size="sm" onClick={() => goToCity(city.pos)} className="px-2 py-1 h-auto text-[10px] bg-white hover:bg-primary/10">
                                {city.name.split(' ')[0]}
                            </Button>
                        ))}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-0 relative">
                <div className="p-4 bg-white/80 backdrop-blur-sm shadow-sm flex flex-wrap gap-3 items-center sticky top-0 z-10 border-b">
                    <div className="relative flex-1 min-w-[250px]">
                        <Autocomplete
                            onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
                            onPlaceChanged={onPlaceChanged}
                        >
                            <Input
                                placeholder="بحث في غرداية..."
                                className="pl-10"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </Autocomplete>
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant={showCadastre ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowCadastre(!showCadastre)}
                            className="px-3"
                        >
                            المسح العقاري (Cadastre)
                        </Button>
                        <Button
                            variant={showTopography ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowTopography(!showTopography)}
                            className="px-3"
                        >
                            الطبوغرافيا (Topo)
                        </Button>
                        <Button variant="outline" size="sm" onClick={toggleMapType} className="flex gap-2">
                            <Layers className="h-4 w-4" />
                            {mapType === google.maps.MapTypeId.ROADMAP ? 'قمر صناعي' : 'خريطة'}
                        </Button>
                    </div>
                </div>

                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={markerPos}
                    zoom={12}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{
                        mapTypeId: mapType,
                        mapTypeControl: false,
                        fullscreenControl: true,
                        streetViewControl: false
                    }}
                >
                    <Marker
                        position={markerPos}
                        draggable={true}
                        onDragEnd={onMarkerDragEnd}
                        icon={{
                            url: 'https://maps.google.com/mapfiles/ms/icons/red-pushpin.png'
                        }}
                    />

                    {mzabCities.map(city => (
                        <Marker
                            key={city.name}
                            position={city.pos}
                            label={{
                                text: city.name.split(' ')[0],
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}
                            icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 4,
                                fillColor: '#D4AF37',
                                fillOpacity: 0.8,
                                strokeWeight: 2,
                                strokeColor: 'white'
                            }}
                        />
                    ))}

                    {/* Placeholders for Cadastral and Topographic Layers */}
                    {showCadastre && (
                        <div className="absolute bottom-4 left-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-800 animate-pulse">
                            جاري تحميل حدود الأقسام والملكيات...
                        </div>
                    )}
                    {showTopography && (
                        <div className="absolute bottom-4 left-4 p-2 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-800 animate-pulse">
                            جاري تحميل طبقة مجرى الوادي والواحات...
                        </div>
                    )}
                </GoogleMap>

                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted border-t">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">خط العرض (Lat)</p>
                        <p className="font-mono text-sm font-bold text-primary">{markerPos.lat.toFixed(6)}°N</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">خط الطول (Lng)</p>
                        <p className="font-mono text-sm font-bold text-primary">{markerPos.lng.toFixed(6)}°E</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground italic mt-2">
                            <MapPin className="h-3 w-3" />
                            منطقة التدخل: حماية وادي ميزاب (Ghardaïa, Beni Isguen, Melika, Bounoura, El Atteuf)
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
