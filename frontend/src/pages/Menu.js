import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const Menu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { cart, addToCart, updateCartQuantity, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API}/menu`);
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];

  const filteredItems = selectedCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const getItemQuantityInCart = (itemId) => {
    const cartItem = cart.find(i => i.menu_item_id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleAddToCart = (item) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      navigate('/auth');
      return;
    }
    
    addToCart(item);
  };

  const handleQuantityChange = (itemId, delta) => {
    const current = getItemQuantityInCart(itemId);
    const newQuantity = current + delta;
    if (newQuantity >= 0) {
      updateCartQuantity(itemId, newQuantity);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-32" data-testid="menu-page">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="menu-title">
            Menu
          </h1>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto hide-scrollbar" data-testid="category-tabs">
          <div className="flex gap-2 px-4 pb-3 max-w-md mx-auto">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className={`whitespace-nowrap ${selectedCategory === category ? 'bg-[#E23744] hover:bg-[#D12E3A]' : ''}`}
                onClick={() => setSelectedCategory(category)}
                data-testid={`category-${category.toLowerCase()}`}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-md mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl h-32 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12" data-testid="no-items-message">
            <p className="text-gray-500">No items available in this category</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="menu-items-list">
            {filteredItems.map(item => {
              const quantityInCart = getItemQuantityInCart(item.id);
              
              return (
                <Card key={item.id} className="border-0 shadow-md overflow-hidden food-card-hover" data-testid={`menu-item-${item.id}`}>
                  <CardContent className="p-0">
                    <div className="flex gap-4">
                      {/* Item Image */}
                      <div className="w-28 h-28 flex-shrink-0">
                        <img 
                          src={item.image_url || 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=200&h=200&fit=crop'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 py-3 pr-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {item.veg ? (
                                <div className="veg-badge" data-testid={`veg-badge-${item.id}`} />
                              ) : (
                                <div className="non-veg-badge" data-testid={`non-veg-badge-${item.id}`} />
                              )}
                              <h3 className="font-semibold text-base" data-testid={`item-name-${item.id}`}>{item.name}</h3>
                            </div>
                            <p className="text-xs text-gray-500" data-testid={`prep-time-${item.id}`}>
                              {item.prep_time} mins
                            </p>
                          </div>
                          <p className="font-bold text-lg text-[#E23744]" data-testid={`item-price-${item.id}`}>
                            ₹{item.price}
                          </p>
                        </div>

                        {/* Add to Cart Button */}
                        {quantityInCart === 0 ? (
                          <Button
                            size="sm"
                            className="btn-primary w-full mt-2"
                            onClick={() => handleAddToCart(item)}
                            data-testid={`add-to-cart-${item.id}`}
                          >
                            <Plus size={16} className="mr-1" />
                            Add
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between bg-[#E23744] rounded-lg px-3 py-2 mt-2" data-testid={`quantity-controls-${item.id}`}>
                            <button
                              onClick={() => handleQuantityChange(item.id, -1)}
                              className="text-white"
                              data-testid={`decrease-quantity-${item.id}`}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="text-white font-semibold" data-testid={`item-quantity-${item.id}`}>
                              {quantityInCart}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.id, 1)}
                              className="text-white"
                              data-testid={`increase-quantity-${item.id}`}
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40" data-testid="floating-cart-btn">
          <div className="max-w-md mx-auto">
            <Link to="/checkout">
              <Button className="w-full btn-primary h-14 text-lg shadow-xl" data-testid="view-cart-btn">
                <ShoppingCart size={20} className="mr-2" />
                View Cart ({cartCount} items)
                <span className="ml-auto font-bold">₹{cartTotal.toFixed(2)}</span>
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;
