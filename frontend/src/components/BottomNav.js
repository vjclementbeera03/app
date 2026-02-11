import { Link, useLocation } from 'react-router-dom';
import { Home, UtensilsCrossed, Gift, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { path: '/dashboard', icon: Gift, label: 'Loyalty' },
    { path: user ? '/profile' : '/auth', icon: User, label: 'Profile' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-50"
      data-testid="bottom-navigation"
    >
      <div className="max-w-md mx-auto flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;