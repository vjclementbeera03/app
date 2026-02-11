import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Search, Loader2, Navigation, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom red marker for shop location
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map click handler component
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to move map to new position
const MapController = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
};

const LocationPicker = ({ onLocationSelect, initialLat = 28.6139, initialLng = 77.2090 }) => {
  const [markerPosition, setMarkerPosition] = useState([initialLat, initialLng]);
  const [selectedLocation, setSelectedLocation] = useState({
    lat: initialLat,
    lng: initialLng,
    address: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Reverse geocode using Nominatim (OpenStreetMap)
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ThuGoZi-FoodApp/1.0'
          }
        }
      );
      const data = await response.json();
      return data.display_name || 'Unknown location';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Unable to get address';
    }
  }, []);

  // Update location with address
  const updateLocation = useCallback(async (lat, lng, address = null) => {
    setMarkerPosition([lat, lng]);
    
    let finalAddress = address;
    if (!finalAddress) {
      finalAddress = await reverseGeocode(lat, lng);
    }
    
    const location = { lat, lng, address: finalAddress };
    setSelectedLocation(location);
    
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  }, [reverseGeocode, onLocationSelect]);

  // Handle map click
  const handleMapClick = useCallback((lat, lng) => {
    updateLocation(lat, lng);
  }, [updateLocation]);

  // Search locations using Nominatim
  const searchLocations = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ThuGoZi-FoodApp/1.0'
          }
        }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(query);
    }, 500);
  };

  // Select search result
  const selectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    updateLocation(lat, lng, result.display_name);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        await updateLocation(lat, lng);
        setGeolocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please enable location access.');
        setGeolocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Initialize with address
  useEffect(() => {
    updateLocation(initialLat, initialLng);
  }, []);

  return (
    <div className="space-y-4" data-testid="location-picker">
      {/* Search Box */}
      <div className="relative">
        <Label className="text-sm font-medium">Search Location</Label>
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search for a location or address..."
            className="pl-10 pr-10"
            data-testid="location-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-[1000] w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => selectSearchResult(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-start gap-3"
                data-testid={`search-result-${index}`}
              >
                <MapPin className="text-[#E23744] mt-0.5 flex-shrink-0" size={16} />
                <span className="text-sm text-gray-700 line-clamp-2">{result.display_name}</span>
              </button>
            ))}
          </div>
        )}
        
        {searching && (
          <div className="absolute z-[1000] w-full mt-1 bg-white border rounded-lg shadow-lg p-4 flex items-center justify-center">
            <Loader2 className="animate-spin mr-2 text-[#E23744]" size={18} />
            <span className="text-sm text-gray-500">Searching...</span>
          </div>
        )}
      </div>

      {/* Current Location Button */}
      <Button
        type="button"
        variant="outline"
        onClick={getCurrentLocation}
        disabled={geolocating}
        className="w-full"
        data-testid="current-location-btn"
      >
        {geolocating ? (
          <Loader2 className="animate-spin mr-2" size={18} />
        ) : (
          <Navigation className="mr-2" size={18} />
        )}
        Use My Current Location
      </Button>

      {/* Map Container */}
      <div className="rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm" style={{ height: '400px' }}>
        <MapContainer
          center={markerPosition}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker 
            position={markerPosition} 
            icon={redIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                updateLocation(position.lat, position.lng);
              },
            }}
          />
          <MapClickHandler onLocationSelect={handleMapClick} />
          <MapController center={markerPosition} />
        </MapContainer>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 font-semibold mb-2">How to use:</p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li className="flex items-center gap-2">
            <Search size={14} /> Search for your location using the search box
          </li>
          <li className="flex items-center gap-2">
            <Navigation size={14} /> Or use your current GPS location
          </li>
          <li className="flex items-center gap-2">
            <MapPin size={14} /> Click anywhere on the map to place the marker
          </li>
          <li className="flex items-center gap-2">
            <span className="text-lg">🖱️</span> Drag the marker to fine-tune the position
          </li>
        </ul>
      </div>

      {/* Selected Location Display */}
      {selectedLocation.address && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg" data-testid="selected-location-display">
          <div className="flex items-start gap-3">
            <MapPin className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-green-800">Selected Location:</p>
              <p className="text-sm text-green-700 mt-1">{selectedLocation.address}</p>
              <p className="text-xs text-green-600 mt-2 font-mono">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
