import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { firebaseSignOut } from '@/lib/firebase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    // Check for stored token
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (token) {
      if (role === 'admin') {
        setIsAdmin(true);
        setLoading(false);
      } else {
        fetchCurrentUser(token);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (token) => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh user data
  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (token && !isAdmin) {
      return await fetchCurrentUser(token);
    }
    return null;
  };

  const login = (token, userData, role = 'user') => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    if (role === 'admin') {
      setIsAdmin(true);
    } else {
      setUser(userData);
    }
  };

  const logout = async () => {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    
    // Clear state
    setUser(null);
    setIsAdmin(false);
    setCart([]);
    
    // Sign out from Firebase
    try {
      await firebaseSignOut();
    } catch (error) {
      console.error('Firebase signout error:', error);
    }
    
    toast.success('Logged out successfully');
  };

  const addToCart = (item, quantity = 1) => {
    setCart(prevCart => {
      const existing = prevCart.find(i => i.menu_item_id === item.id);
      if (existing) {
        return prevCart.map(i => 
          i.menu_item_id === item.id 
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prevCart, {
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: quantity,
        veg: item.veg
      }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity === 0) {
      setCart(prevCart => prevCart.filter(i => i.menu_item_id !== itemId));
    } else {
      setCart(prevCart => prevCart.map(i => 
        i.menu_item_id === itemId ? { ...i, quantity } : i
      ));
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin, 
      login, 
      logout, 
      loading,
      refreshUser,
      cart, 
      addToCart, 
      updateCartQuantity, 
      clearCart 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
