import React, { useState, useCallback, useRef } from 'react';
import {
    GoogleMap,
    useJsApiLoader,
    Marker,
    Autocomplete,
} from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, X, Search, ChevronDown, ChevronUp } from 'lucide-react';

const libraries: ('places')[] = ['places'];

const mapContainerStyle = {
    width: '100%',
    height: '300px',
    borderRadius: '8px',
};

const defaultCenter = { lat: 32.4810, lng: 3.6900 };

interface PermitLocationPickerProps {
    value: { lat: number; lng: number } | null;
    onChange: (location: { lat: number; lng: number } | null) => void;
}

export default function PermitLocationPicker({ value, onChange }: PermitLocationPickerProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries,
    });

    const [isOpen, setIsOpen] = useState(false);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [searchAddress, setSearchAddress] = useState('');
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    const onLoad = useCallback((mapInstance: google.maps.Map) => {
        setMap(mapInstance);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const onMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    };

    const onMapClick = (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
    };

    const onPlaceChanged = () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
            const newPos = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
            };
            onChange(newPos);
            setSearchAddress(place.formatted_address || '');
            if (map) {
                map.panTo(newPos);
                map.setZoom(16);
            }
        }
    };

    const handleRemoveLocation = () => {
        onChange(null);
        setSearchAddress('');
    };

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    // If Google Maps API key is missing, show a simple coordinate input fallback
    const apiKeyMissing = !import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    تركيز مكان الرخصة في الخريطة
                    <span className="text-xs text-muted-foreground font-normal">(اختياري)</span>
                </Label>
                {value && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLocation}
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    >
                        <X className="w-3 h-3 ml-1" />
                        إزالة الموقع
                    </Button>
                )}
            </div>

            {/* Current coordinates display */}
            {value && (
                <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex gap-4 font-mono text-xs">
                        <span>Lat: <strong>{value.lat.toFixed(6)}</strong></span>
                        <span>Lng: <strong>{value.lng.toFixed(6)}</strong></span>
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleOpen}
                className="w-full justify-between gap-2 text-sm"
            >
                <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {value ? 'تعديل الموقع على الخريطة' : 'تحديد الموقع على الخريطة'}
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {/* Map panel */}
            {isOpen && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                    {apiKeyMissing ? (
                        <div className="p-4 border-2 border-dashed border-yellow-300 bg-yellow-50 rounded-lg text-center text-sm text-yellow-700">
                            <MapPin className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                            <p>مفتاح Google Maps API غير متوفر</p>
                            <p className="text-xs mt-1">يرجى إضافة VITE_GOOGLE_MAPS_API_KEY في ملف .env</p>
                        </div>
                    ) : loadError ? (
                        <div className="p-4 border-2 border-dashed border-red-300 bg-red-50 rounded-lg text-center text-sm text-red-600">
                            <p>خطأ في تحميل الخريطة</p>
                            <code className="text-xs">{loadError.message}</code>
                        </div>
                    ) : !isLoaded ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="mr-2 text-sm text-muted-foreground">جاري تحميل الخريطة…</span>
                        </div>
                    ) : (
                        <>
                            {/* Search bar */}
                            <div className="relative">
                                <Autocomplete
                                    onLoad={(ac) => (autocompleteRef.current = ac)}
                                    onPlaceChanged={onPlaceChanged}
                                >
                                    <Input
                                        placeholder="ابحث عن موقع..."
                                        className="pl-9 text-sm h-8"
                                        value={searchAddress}
                                        onChange={(e) => setSearchAddress(e.target.value)}
                                    />
                                </Autocomplete>
                                <Search className="absolute left-3 top-2 h-4 w-4 text-muted-foreground" />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                انقر على الخريطة أو اسحب المؤشر لتحديد الموقع
                            </p>

                            {/* Mini map */}
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={value || defaultCenter}
                                zoom={value ? 16 : 13}
                                onLoad={onLoad}
                                onUnmount={onUnmount}
                                onClick={onMapClick}
                                options={{
                                    mapTypeId: 'satellite',
                                    mapTypeControl: false,
                                    fullscreenControl: true,
                                    streetViewControl: false,
                                    scaleControl: true,
                                    zoomControl: true,
                                    tilt: 0,
                                    rotateControl: false,
                                }}
                            >
                                {value && (
                                    <Marker
                                        position={value}
                                        draggable
                                        onDragEnd={onMarkerDragEnd}
                                        icon={{
                                            url: 'https://maps.google.com/mapfiles/ms/icons/red-pushpin.png',
                                        }}
                                    />
                                )}
                            </GoogleMap>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
