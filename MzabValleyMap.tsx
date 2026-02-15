import React, { useMemo } from 'react';
import { GoogleMap, useJsApiLoader, HeatmapLayer } from '@react-google-maps/api';

const containerStyle = {
    width: '100%',
    height: '100vh', // Full screen for "high detail"
};

// Centered roughly between the 5 Ksour
const center = {
    lat: 32.4800,
    lng: 3.6850,
};

// Coordinates for the 5 Ksour to generate mock density data around
const KSOUR_LOCATIONS = [
    { name: 'Ghardaïa', lat: 32.4909, lng: 3.6738 },
    { name: 'Melika', lat: 32.4833, lng: 3.6780 },
    { name: 'Beni Isguen', lat: 32.4727, lng: 3.6852 },
    { name: 'Bounoura', lat: 32.4800, lng: 3.6800 },
    { name: 'El Atteuf', lat: 32.4700, lng: 3.7000 },
];

// Generate mock heatmap points to simulate "building density"
const generateHeatmapData = () => {
    const points: google.maps.LatLngLiteral[] = [];
    KSOUR_LOCATIONS.forEach((ksar) => {
        // Create a dense cluster around each Ksar
        for (let i = 0; i < 200; i++) {
            points.push({
                lat: ksar.lat + (Math.random() - 0.5) * 0.008,
                lng: ksar.lng + (Math.random() - 0.5) * 0.008,
            });
        }
    });
    return points;
};

const mapOptions: google.maps.MapOptions = {
    mapTypeId: 'satellite', // "Highly realistic satellite imagery style"
    tilt: 0, // Top-down view
    disableDefaultUI: false,
    zoomControl: true,
    scaleControl: true, // "Scale bar included"
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
};

// "Semi-transparent red and orange" gradient
const heatmapGradient = [
    'rgba(0, 255, 255, 0)',
    'rgba(0, 255, 255, 1)',
    'rgba(0, 191, 255, 1)',
    'rgba(0, 127, 255, 1)',
    'rgba(0, 63, 255, 1)',
    'rgba(0, 0, 255, 1)',
    'rgba(0, 0, 223, 1)',
    'rgba(0, 0, 191, 1)',
    'rgba(0, 0, 159, 1)',
    'rgba(0, 0, 127, 1)',
    'rgba(63, 0, 91, 1)',
    'rgba(127, 0, 63, 1)',
    'rgba(191, 0, 31, 1)',
    'rgba(255, 0, 0, 1)' // Red for high density
];

export const MzabValleyMap = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
        libraries: ['visualization'], // Required for HeatmapLayer
    });

    const heatmapData = useMemo(() => generateHeatmapData(), []);

    const onLoad = React.useCallback(function callback(map: google.maps.Map) {
        // Optional: Add custom overlay logic here if needed
    }, []);

    const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
        // Cleanup
    }, []);

    if (!isLoaded) return <div>Loading Map...</div>;

    return (
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={14} // Detailed view of the valley
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={mapOptions}
        >
            <HeatmapLayer
                data={heatmapData.map(point => new google.maps.LatLng(point.lat, point.lng))}
                options={{
                    radius: 20,
                    opacity: 0.6,
                    gradient: heatmapGradient
                }}
            />
        </GoogleMap>
    );
};