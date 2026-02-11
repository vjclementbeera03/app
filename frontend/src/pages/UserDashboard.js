import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Gift, Upload, LogOut, AlertCircle, CheckCircle, Clock, GraduationCap, Calendar, Building2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const UserDashboard = () => {
  const { user, logout, refreshUser } = useAuth();
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('loyalty');
  const navigate = useNavigate();
  
  // Apply form state
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [college, setCollege] = useState('');
  const [dob, setDob] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLoyaltyPoints();
      fetchLoyaltyHistory();
      fetchOrders();
    }
  }, [user]);

  const fetchLoyaltyPoints = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/loyalty/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLoyaltyPoints(response.data.points);
    } catch (error) {
      console.error('Failed to fetch loyalty points:', error);
    }
  };

  const fetchLoyaltyHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/loyalty/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLoyaltyHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch loyalty history:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/orders/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleApplyStudentLoyalty = async (e) => {
    e.preventDefault();
    
    if (!college.trim()) {
      toast.error('Please enter your college name');
      return;
    }
    
    if (!dob) {
      toast.error('Please enter your date of birth');
      return;
    }
    
    setApplying(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/auth/apply-student-loyalty`, {
        college: college.trim(),
        dob: dob
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(response.data.message || 'Applied successfully! Now upload your Student ID');
      setShowApplyForm(false);
      
      // Refresh user data to show the upload section
      if (refreshUser) {
        await refreshUser();
      } else {
        // Fallback: reload the page
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to apply. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const handleStudentIDUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/auth/upload-student-id`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 60000 // 60 second timeout for upload
      });

      if (response.data.success !== false) {
        toast.success(response.data.message || 'Student ID uploaded! Pending verification.');
        // Refresh user data
        if (refreshUser) {
          await refreshUser();
        } else {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        toast.error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Failed to upload. Please try again.');
    } finally {
      setLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleBillUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/loyalty/upload-bill`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 60000
      });

      toast.success(response.data.message || 'Bill uploaded successfully!');
      fetchLoyaltyPoints();
      fetchLoyaltyHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload bill');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Check if user needs to upload student ID
  const needsStudentIdUpload = user?.is_student && 
    user?.verification_status !== 'approved' && 
    user?.verification_status !== 'pending';

  // Check if verification is pending
  const verificationPending = user?.is_student && user?.verification_status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50 pb-24" data-testid="user-dashboard">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#E23744] to-[#F97583] text-white">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="user-name">
                {user?.name}
              </h1>
              <p className="text-white/80 text-sm" data-testid="user-college">
                {user?.college || user?.phone_number}
              </p>
            </div>
            <Button variant="ghost" className="text-white hover:bg-white/20" onClick={handleLogout} data-testid="logout-btn">
              <LogOut size={20} />
            </Button>
          </div>

          {/* Verification Status for Students */}
          {user?.is_student && (
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  {user?.verification_status === 'approved' ? (
                    <>
                      <CheckCircle className="text-green-300" size={24} />
                      <div>
                        <p className="font-semibold">Verified Student</p>
                        <p className="text-sm text-white/80">You can earn loyalty points</p>
                      </div>
                    </>
                  ) : user?.verification_status === 'pending' ? (
                    <>
                      <Clock className="text-yellow-300" size={24} />
                      <div>
                        <p className="font-semibold">Verification Pending</p>
                        <p className="text-sm text-white/80">Your ID is being reviewed</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-yellow-300" size={24} />
                      <div>
                        <p className="font-semibold">Upload Student ID</p>
                        <p className="text-sm text-white/80">Go to Loyalty tab to upload</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Apply for loyalty button - only if not a student */}
          {!user?.is_student && (
            <Button 
              variant="ghost" 
              size="sm"
              className="w-full mt-2 text-white/90 hover:text-white hover:bg-white/10 text-xs"
              onClick={() => {
                setActiveTab('loyalty');
                setShowApplyForm(true);
              }}
              data-testid="apply-loyalty-btn"
            >
              <Gift size={14} className="mr-1" />
              Are you a student? Apply for loyalty rewards
            </Button>
          )}
        </div>
      </div>

      {/* Loyalty Points Card */}
      <div className="max-w-md mx-auto px-4 -mt-6">
        <Card className="loyalty-card-gradient text-white border-0 shadow-xl" data-testid="loyalty-points-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">Your Loyalty Points</p>
                <p className="text-5xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="loyalty-points-value">
                  {loyaltyPoints}
                </p>
              </div>
              <Gift size={48} className="text-white/80" />
            </div>
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-xs text-white/80">
                Earn 1 point for bills ₹100-199 | Earn 2 points for bills ₹200+
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="max-w-md mx-auto px-4 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="dashboard-tabs">
          <TabsList className="w-full">
            <TabsTrigger value="loyalty" className="flex-1" data-testid="loyalty-tab">Loyalty</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1" data-testid="orders-tab">Orders</TabsTrigger>
          </TabsList>

          {/* Loyalty Tab */}
          <TabsContent value="loyalty" className="space-y-4">
            
            {/* Apply Form - Show when user is not a student and wants to apply */}
            {!user?.is_student && (showApplyForm || true) && (
              <Card className="border-2 border-blue-300 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="text-blue-600" size={24} />
                    Apply for Student Loyalty
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleApplyStudentLoyalty} className="space-y-4">
                    <div>
                      <Label htmlFor="college" className="flex items-center gap-1 mb-1">
                        <Building2 size={14} />
                        College/University Name
                      </Label>
                      <Input
                        id="college"
                        type="text"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="Enter your college name"
                        required
                        data-testid="college-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dob" className="flex items-center gap-1 mb-1">
                        <Calendar size={14} />
                        Date of Birth
                      </Label>
                      <Input
                        id="dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        required
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="dob-input"
                      />
                      <p className="text-xs text-gray-500 mt-1">Age must be 17-23 years</p>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={applying}
                      data-testid="submit-apply-btn"
                    >
                      {applying ? 'Applying...' : 'Apply for Student Loyalty'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Student ID Upload Section - Show when is_student=true but not yet approved */}
            {needsStudentIdUpload && (
              <Card className="border-2 border-[#E23744]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-[#E23744]">
                    <Upload size={20} />
                    Upload Student ID
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    {user?.verification_status === 'rejected' 
                      ? (user?.rejection_reason || 'Your previous ID was rejected. Please upload a clearer photo.')
                      : 'Upload a clear photo of your student ID card showing your name and date of birth.'}
                  </p>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleStudentIDUpload}
                      className="hidden"
                      id="student-id-upload"
                      disabled={loading}
                      data-testid="student-id-upload-input"
                    />
                    <Upload className="mx-auto mb-3 text-gray-400" size={40} />
                    <p className="text-sm text-gray-500 mb-3">Click to upload your Student ID</p>
                    <Button
                      onClick={() => document.getElementById('student-id-upload').click()}
                      disabled={loading}
                      className="bg-[#E23744] hover:bg-[#c42f3c]"
                      data-testid="upload-student-id-btn"
                    >
                      {loading ? 'Uploading...' : 'Choose Photo'}
                    </Button>
                  </div>
                  
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Tips:</strong> Ensure the photo is clear, well-lit, and shows your full ID card with readable text.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verification Pending Notice */}
            {verificationPending && (
              <Card className="border-2 border-yellow-400 bg-yellow-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <Clock className="text-yellow-600 flex-shrink-0" size={32} />
                    <div>
                      <p className="font-semibold text-yellow-800">Verification In Progress</p>
                      <p className="text-sm text-yellow-700">
                        Your student ID is being reviewed. This usually takes 24-48 hours.
                        You'll be notified once approved.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upload Bill Button - Only for verified students */}
            <Card>
              <CardContent className="pt-6">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBillUpload}
                  className="hidden"
                  id="bill-upload"
                  data-testid="bill-upload-input"
                />
                <Button
                  className="w-full btn-primary"
                  onClick={() => document.getElementById('bill-upload').click()}
                  disabled={loading || user?.verification_status !== 'approved'}
                  data-testid="upload-bill-btn"
                >
                  <Upload size={20} className="mr-2" />
                  {loading ? 'Uploading...' : 'Upload Bill'}
                </Button>
                {user?.verification_status !== 'approved' && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    {!user?.is_student 
                      ? 'Apply for student loyalty above to upload bills'
                      : 'Complete verification to start uploading bills'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Bill History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bill History</CardTitle>
              </CardHeader>
              <CardContent>
                {loyaltyHistory.length === 0 ? (
                  <p className="text-center text-gray-500 py-4" data-testid="no-bills-message">No bills uploaded yet</p>
                ) : (
                  <div className="space-y-3" data-testid="bill-history-list">
                    {loyaltyHistory.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid={`bill-item-${bill.id}`}>
                        <div>
                          <p className="font-semibold">₹{bill.amount}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(bill.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(bill.status)}>
                            {bill.status}
                          </Badge>
                          <p className="text-sm font-semibold text-[#239D60] mt-1">
                            +{bill.points_earned} pts
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-gray-500" data-testid="no-orders-message">No orders yet</p>
                  <Button 
                    className="mt-4 btn-primary"
                    onClick={() => navigate('/menu')}
                    data-testid="browse-menu-btn"
                  >
                    Browse Menu
                  </Button>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id} data-testid={`order-item-${order.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">Order #{order.id.slice(-6)}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold text-[#E23744]">₹{order.total}</p>
                    <p className="text-sm text-gray-500 mt-2">{order.delivery_address}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default UserDashboard;
