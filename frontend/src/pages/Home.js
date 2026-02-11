import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, MapPin, Clock, UtensilsCrossed, Gift, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const { user } = useAuth();
  const [shopStatus, setShopStatus] = useState({ is_open: true, message: 'Open Now' });
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchShopStatus();
    fetchSettings();
  }, []);

  const fetchShopStatus = async () => {
    try {
      const response = await axios.get(`${API}/shop/status`);
      setShopStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch shop status:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      // Use defaults
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="home-page">
      {/* Hero Section */}
      <div 
        className="relative h-[400px] bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxidXJnZXIlMjBmcmllc3xlbnwwfHx8fDE3NzAyMjUzNTJ8MA&ixlib=rb-4.1.0&q=85')`
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
        <div className="relative h-full max-w-md mx-auto px-6 flex flex-col justify-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {settings?.shop_name || 'Local Food Hub'}
          </h1>
          <p className="text-lg mb-6 text-gray-200">
            {settings?.shop_tagline || 'Delicious meals for college students'}
          </p>
          
          {/* Status Badge */}
          <div className="mb-6">
            {shopStatus.is_open ? (
              <span className="status-open" data-testid="shop-status-open">
                <Clock size={16} />
                {shopStatus.message}
              </span>
            ) : (
              <span className="status-closed" data-testid="shop-status-closed">
                <Clock size={16} />
                {shopStatus.message}
              </span>
            )}
          </div>

          <Link to="/menu">
            <Button 
              className="btn-primary text-lg h-14 px-8 rounded-lg"
              data-testid="order-now-btn"
            >
              Order Now
              <ChevronRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-md mx-auto px-4 py-8" data-testid="features-section">
        <div className="space-y-4">
          {/* Delivery Info */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm" data-testid="delivery-info-card">
            <div className="flex items-start gap-4">
              <div className="bg-[#FCE7E9] p-3 rounded-lg">
                <MapPin className="text-[#E23744]" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Fast Delivery</h3>
                <p className="text-gray-600 text-sm">
                  Free delivery within 2km radius. Flat ₹{settings?.delivery_charge || 50} delivery charge.
                </p>
              </div>
            </div>
          </div>

          {/* Loyalty Program */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm" data-testid="loyalty-info-card">
            <div className="flex items-start gap-4">
              <div className="bg-[#E6F6EC] p-3 rounded-lg">
                <Gift className="text-[#239D60]" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Loyalty Rewards</h3>
                <p className="text-gray-600 text-sm">
                  Earn points on every bill! ₹100-199 = 1 point, ₹200+ = 2 points.
                </p>
                {!user && (
                  <Link to="/auth">
                    <Button variant="link" className="p-0 h-auto mt-2 text-[#E23744]" data-testid="join-now-link">
                      Join Now →
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Student Exclusive */}
          <div className="bg-gradient-to-br from-[#E23744] to-[#F97583] rounded-xl p-6 text-white" data-testid="student-exclusive-card">
            <h3 className="font-bold text-xl mb-2">Student Exclusive!</h3>
            <p className="text-white/90 text-sm mb-4">
              Special loyalty program for college students aged 17-23. Upload your student ID to get started.
            </p>
            {!user && (
              <Link to="/auth">
                <Button variant="secondary" className="bg-white text-[#E23744] hover:bg-gray-100" data-testid="get-started-btn">
                  Get Started
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-md mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Explore</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link to="/menu" data-testid="explore-menu-link">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
              <UtensilsCrossed className="mx-auto mb-3 text-[#E23744]" size={32} />
              <h3 className="font-semibold">Menu</h3>
            </div>
          </Link>
          <Link to="/about" data-testid="explore-about-link">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm text-center hover:shadow-md transition-shadow">
              <Info className="mx-auto mb-3 text-[#239D60]" size={32} />
              <h3 className="font-semibold">About Us</h3>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;