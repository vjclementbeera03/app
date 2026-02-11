import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Minus, Trash2, MapPin, Tag } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const Checkout = () => {
  const { cart, updateCartQuantity, clearCart, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(50);
  const [locationValid, setLocationValid] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/menu');
    }
    fetchSettings();
    getLocation();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setDeliveryFee(response.data.delivery_charge);
      setSettings(response.data);
    } catch (error) {
      // Use default
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setLatitude(lat);
          setLongitude(lon);
          
          // Validate location
          try {
            const response = await axios.post(`${API}/validate-location`, {
              latitude: lat,
              longitude: lon
            });
            setLocationValid(response.data.delivery_available);
            if (!response.data.delivery_available) {
              toast.error(`Delivery not available. You are ${response.data.distance_km}km away (max 2km)`);
            }
          } catch (error) {
            console.error('Location validation error:', error);
          }
        },
        (error) => {
          toast.error('Please enable location access for delivery');
        }
      );
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = appliedCoupon 
    ? appliedCoupon.type === 'flat' 
      ? appliedCoupon.value 
      : (subtotal * appliedCoupon.value) / 100
    : 0;
  const total = subtotal + deliveryFee - discount;

  const handleApplyCoupon = async () => {
    try {
      const response = await axios.get(`${API}/coupons/validate/${couponCode}`);
      setAppliedCoupon(response.data);
      toast.success('Coupon applied successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid coupon code');
    }
  };

  const handlePlaceOrder = async () => {
    if (!address.trim()) {
      toast.error('Please enter delivery address');
      return;
    }

    if (!latitude || !longitude) {
      toast.error('Please enable location access');
      return;
    }

    if (locationValid === false) {
      toast.error('Delivery not available at your location');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const orderData = {
        items: cart.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          price: item.price
        })),
        delivery_address: address,
        latitude,
        longitude,
        coupon_code: appliedCoupon?.code || null
      };

      const response = await axios.post(`${API}/orders`, orderData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Order placed successfully!');
      clearCart();
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24" data-testid="checkout-page">
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="checkout-title">
          Checkout
        </h1>

        {/* Cart Items */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Order Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-testid="cart-items-list">
            {cart.map((item) => (
              <div key={item.menu_item_id} className="flex items-center justify-between" data-testid={`cart-item-${item.menu_item_id}`}>
                <div className="flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-500">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
                    <button
                      onClick={() => updateCartQuantity(item.menu_item_id, item.quantity - 1)}
                      className="text-gray-600"
                      data-testid={`decrease-qty-${item.menu_item_id}`}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-semibold" data-testid={`qty-${item.menu_item_id}`}>{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.menu_item_id, item.quantity + 1)}
                      className="text-gray-600"
                      data-testid={`increase-qty-${item.menu_item_id}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="font-bold text-lg">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin size={20} />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Delivering from:</p>
                <p className="text-sm font-semibold">{settings.shop_name}</p>
                <p className="text-xs text-gray-600">{settings.shop_address}</p>
                <p className="text-xs text-gray-500 mt-2">Delivery radius: {settings.delivery_radius_km || 2}km</p>
              </div>
            )}
            <div>
              <Label htmlFor="address">Your Delivery Address</Label>
              <Input
                id="address"
                placeholder="Enter your complete address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-2"
                data-testid="address-input"
              />
            </div>
            {locationValid !== null && (
              <p className={`text-sm ${locationValid ? 'text-green-600' : 'text-red-600'}`} data-testid="location-status">
                {locationValid 
                  ? `✓ Delivery available at your location` 
                  : `✗ Delivery not available (beyond ${settings?.delivery_radius_km || 2}km radius). Pickup only.`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Coupon */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag size={20} />
              Apply Coupon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={appliedCoupon !== null}
                data-testid="coupon-input"
              />
              <Button
                onClick={handleApplyCoupon}
                disabled={!couponCode || appliedCoupon !== null}
                data-testid="apply-coupon-btn"
              >
                Apply
              </Button>
            </div>
            {appliedCoupon && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between" data-testid="applied-coupon">
                <p className="text-sm text-green-800 font-semibold">
                  {appliedCoupon.type === 'flat' 
                    ? `₹${appliedCoupon.value} OFF` 
                    : `${appliedCoupon.value}% OFF`}
                </p>
                <button
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponCode('');
                  }}
                  className="text-red-600"
                  data-testid="remove-coupon-btn"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bill Summary */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold" data-testid="subtotal-amount">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="font-semibold" data-testid="delivery-fee-amount">₹{deliveryFee.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span className="font-semibold" data-testid="discount-amount">-₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-3 border-t flex justify-between text-lg">
              <span className="font-bold">Total</span>
              <span className="font-bold text-[#E23744]" data-testid="total-amount">₹{total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Place Order Button */}
        <Button
          className="w-full btn-primary h-14 text-lg"
          onClick={handlePlaceOrder}
          disabled={loading || locationValid === false || !address.trim()}
          data-testid="place-order-btn"
        >
          {loading ? 'Placing Order...' : 'Place Order (COD)'}
        </Button>
      </div>
    </div>
  );
};

export default Checkout;
