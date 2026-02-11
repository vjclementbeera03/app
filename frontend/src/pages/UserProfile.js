import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertTriangle, User, Phone, Building2, Calendar, LogOut, Gift } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const UserProfile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [applying, setApplying] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getVerificationStatus = () => {
    const status = user?.verification_status;
    
    if (!status || status === 'not_applied') {
      return {
        status: 'not_applied',
        icon: AlertTriangle,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
        title: '🎁 Student Loyalty Program',
        message: 'You haven\'t joined our student loyalty program yet.',
        showApplyButton: true
      };
    }

    if (status === 'not_started') {
      return {
        status: 'not_started',
        icon: AlertTriangle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-300',
        title: '📤 Upload Required',
        message: 'You\'ve applied! Go to Loyalty tab to upload your student ID.',
        showApplyButton: false
      };
    }

    if (status === 'pending') {
      return {
        status: 'pending',
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
        title: '⏳ Verification Pending',
        message: 'Your student ID is under review.',
        showApplyButton: false
      };
    }

    if (status === 'rejected') {
      return {
        status: 'rejected',
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
        title: '❌ Verification Rejected',
        message: user?.rejection_reason || 'Please go to Loyalty tab to upload a new ID.',
        showApplyButton: false
      };
    }

    if (status === 'approved') {
      return {
        status: 'approved',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
        title: '✅ Verified Student',
        message: 'You can earn loyalty points and get exclusive rewards!',
        showApplyButton: false
      };
    }

    return {
      status: 'unknown',
      icon: AlertTriangle,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-300',
      title: 'Status Unknown',
      message: 'Please contact support.',
      showApplyButton: false
    };
  };

  const handleApplyStudentLoyalty = async () => {
    setApplying(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/auth/apply-student-loyalty`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      toast.success(response.data.message || 'Application submitted! Go to Loyalty tab to upload your ID.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply for student loyalty');
    } finally {
      setApplying(false);
    }
  };

  const verificationInfo = getVerificationStatus();
  const StatusIcon = verificationInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 pb-24" data-testid="user-profile-page">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
            My Profile
          </h1>
          <Button variant="outline" onClick={handleLogout} data-testid="profile-logout-btn">
            <LogOut size={16} className="mr-2" />
            Logout
          </Button>
        </div>

        {/* Verification Status Card - Simplified, no upload */}
        <Card className={`mb-6 border-2 ${verificationInfo.borderColor}`}>
          <CardHeader className={verificationInfo.bgColor}>
            <div className="flex items-start gap-4">
              <StatusIcon className={verificationInfo.color} size={32} />
              <div className="flex-1">
                <CardTitle className="text-lg mb-1">{verificationInfo.title}</CardTitle>
                <p className="text-sm text-gray-700">{verificationInfo.message}</p>
                {verificationInfo.status === 'approved' && (
                  <Badge className="mt-2 bg-green-600">Full Access Granted</Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Personal Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User size={20} />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <User size={16} />
                  Full Name
                </p>
                <p className="font-semibold" data-testid="profile-name">{user?.name || 'N/A'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Phone size={16} />
                  Phone Number
                </p>
                <p className="font-semibold" data-testid="profile-phone">{user?.phone_number || 'N/A'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Building2 size={16} />
                  College
                </p>
                <p className="font-semibold" data-testid="profile-college">{user?.college || 'N/A'}</p>
              </div>

              {user?.age && (
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Calendar size={16} />
                    Age
                  </p>
                  <p className="font-semibold" data-testid="profile-age">{user.age} years</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500">Account Created</p>
              <p className="text-sm font-semibold">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Small Apply for Loyalty Button - Only show if not applied */}
        {verificationInfo.showApplyButton && (
          <Card className="border-dashed border-2 border-blue-300 bg-blue-50/50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="text-blue-600" size={20} />
                  <span className="text-sm text-gray-700">Are you a student?</span>
                </div>
                <Button 
                  size="sm"
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                  onClick={handleApplyStudentLoyalty}
                  disabled={applying}
                  data-testid="apply-student-loyalty-btn"
                >
                  {applying ? 'Applying...' : 'Apply for Loyalty'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Go to Loyalty Tab - Show when needs to upload */}
        {(verificationInfo.status === 'not_started' || verificationInfo.status === 'rejected') && (
          <Card className="border-dashed border-2 border-orange-300 bg-orange-50/50 mt-4">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="text-orange-600" size={20} />
                  <span className="text-sm text-gray-700">Upload your Student ID to complete verification</span>
                </div>
                <Button 
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => navigate('/dashboard')}
                  data-testid="go-to-loyalty-btn"
                >
                  Go to Loyalty
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
