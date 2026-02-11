import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import '@/App.css';

// Import pages
import Home from '@/pages/Home';
import About from '@/pages/About';
import Menu from '@/pages/Menu';
import AuthPage from '@/pages/AuthPage';
import UserDashboard from '@/pages/UserDashboard';
import UserProfile from '@/pages/UserProfile';
import AdminDashboard from '@/pages/AdminDashboard';
import Checkout from '@/pages/Checkout';
import BottomNav from '@/components/BottomNav';

function AppRoutes() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route 
          path="/dashboard" 
          element={user ? <UserDashboard /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/profile" 
          element={user ? <UserProfile /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/checkout" 
          element={user ? <Checkout /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/admin" 
          element={isAdmin ? <AdminDashboard /> : <Navigate to="/auth" />} 
        />
      </Routes>
      {!isAdmin && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}

export default App;