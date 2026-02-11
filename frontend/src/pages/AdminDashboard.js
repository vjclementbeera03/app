import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Users, ShoppingBag, Gift, LogOut, Plus, Check, X, Upload, Trash2, Eye, GraduationCap, User, Filter, AlertCircle, Clock, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

import LocationPicker from '@/components/LocationPicker';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [studentUsers, setStudentUsers] = useState([]);
  const [normalUsers, setNormalUsers] = useState([]);
  const [studentFilter, setStudentFilter] = useState('all'); // all, verified, pending, rejected
  const [normalFilter, setNormalFilter] = useState('all'); // all
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userTypeTab, setUserTypeTab] = useState('students'); // students or normal
  const [deletingUserId, setDeletingUserId] = useState(null);
  
  // Form states
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    price: '',
    category: '',
    veg: true,
    prep_time: ''
  });
  const [aboutContent, setAboutContent] = useState({ title: '', content: '' });
  const [settings, setSettings] = useState({
    delivery_charge: 50,
    shop_name: 'Thu.Go.Zi – Food on Truck',
    shop_tagline: 'Fresh food delivered from our food truck',
    shop_latitude: 28.6139,
    shop_longitude: 77.2090,
    shop_address: 'Connaught Place, New Delhi, India',
    delivery_radius_km: 2.0,
    payment_info: 'Cash on Delivery only',
    weekly_off_day: 1
  });
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: 'flat',
    value: '',
    min_order: 0,
    expiry_date: '',
    usage_limit: 100
  });
  const [menuPDFs, setMenuPDFs] = useState([]);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [usernameForm, setUsernameForm] = useState({
    new_username: '',
    password: ''
  });
  const [loyaltyExpiryLogs, setLoyaltyExpiryLogs] = useState([]);
  const [runningExpiryCheck, setRunningExpiryCheck] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, usersRes, verificationsRes, menuRes, ordersRes, settingsRes, pdfsRes, studentUsersRes, normalUsersRes, expiryLogsRes, couponsRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/verifications/pending`, { headers }),
        axios.get(`${API}/menu`),
        axios.get(`${API}/admin/orders`, { headers }),
        axios.get(`${API}/settings`),
        axios.get(`${API}/admin/menu-pdfs`, { headers }),
        axios.get(`${API}/admin/users/students`, { headers }),
        axios.get(`${API}/admin/users/non-students`, { headers }),
        axios.get(`${API}/admin/loyalty/expiry-logs?limit=20`, { headers }),
        axios.get(`${API}/admin/coupons`, { headers })
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setPendingVerifications(verificationsRes.data);
      setMenuItems(menuRes.data);
      setOrders(ordersRes.data);
      setSettings(settingsRes.data);
      setMenuPDFs(pdfsRes.data);
      setStudentUsers(studentUsersRes.data);
      setNormalUsers(normalUsersRes.data);
      setLoyaltyExpiryLogs(expiryLogsRes.data);
      setCoupons(couponsRes.data);

      // Fetch about content
      const aboutRes = await axios.get(`${API}/about`);
      setAboutContent(aboutRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const handleTriggerExpiryCheck = async () => {
    setRunningExpiryCheck(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/loyalty/check-expiry`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Loyalty expiry check completed');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to run expiry check');
    } finally {
      setRunningExpiryCheck(false);
    }
  };

  const handleApproveVerification = async (verificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/verifications/approve/${verificationId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Verification approved');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to approve verification');
    }
  };

  const handleRejectVerification = async (verificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/verifications/reject/${verificationId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Verification rejected');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to reject verification');
    }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/menu`, {
        ...newMenuItem,
        price: parseFloat(newMenuItem.price),
        prep_time: parseInt(newMenuItem.prep_time)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Menu item added');
      setNewMenuItem({ name: '', price: '', category: '', veg: true, prep_time: '' });
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add menu item');
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/menu/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Menu item deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete menu item');
    }
  };

  const handleUpdateAbout = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/about`, aboutContent, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('About content updated');
    } catch (error) {
      toast.error('Failed to update about content');
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/admin/settings`, {
        ...settings,
        delivery_charge: parseFloat(settings.delivery_charge),
        delivery_radius_km: parseFloat(settings.delivery_radius_km),
        shop_latitude: parseFloat(settings.shop_latitude),
        shop_longitude: parseFloat(settings.shop_longitude)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Settings updated successfully');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/coupons`, {
        ...newCoupon,
        value: parseFloat(newCoupon.value),
        min_order: parseFloat(newCoupon.min_order),
        usage_limit: parseInt(newCoupon.usage_limit)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Coupon created');
      setNewCoupon({
        code: '',
        type: 'flat',
        value: '',
        min_order: 0,
        expiry_date: '',
        usage_limit: 100
      });
    } catch (error) {
      toast.error('Failed to create coupon');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploadingPDF(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('keep_previous', 'false');

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/menu-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Menu PDF uploaded successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to upload PDF');
    } finally {
      setUploadingPDF(false);
    }
  };

  const handleDeletePDF = async (pdfId) => {
    if (!window.confirm('Are you sure you want to delete this menu PDF?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/menu-pdf/${pdfId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('PDF deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete PDF');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/change-password`, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    }
  };

  const handleChangeUsername = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/change-username`, {
        new_username: usernameForm.new_username,
        password: usernameForm.password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Username changed successfully. Please login again.');
      logout();
      navigate('/auth');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change username');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    setDeletingUserId(userId);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted successfully');
      setShowUserModal(false);
      setSelectedUser(null);
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDisableLoyalty = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/admin/users/${userId}/disable-loyalty`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Loyalty disabled for user');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to disable loyalty');
    }
  };

  const getFilteredStudentUsers = () => {
    if (studentFilter === 'all') return studentUsers;
    if (studentFilter === 'verified') return studentUsers.filter(u => u.verification_status === 'approved');
    if (studentFilter === 'pending') return studentUsers.filter(u => u.verification_status === 'pending');
    if (studentFilter === 'rejected') return studentUsers.filter(u => u.verification_status === 'rejected');
    if (studentFilter === 'not_applied') return studentUsers.filter(u => u.verification_status === 'not_started' || u.verification_status === 'not_applied');
    return studentUsers;
  };

  const getVerificationStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'not_started':
      case 'not_applied':
        return <Badge className="bg-gray-100 text-gray-800">Not Applied</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" data-testid="admin-dashboard">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="admin-title">
            Admin Dashboard
          </h1>
          <Button variant="outline" onClick={handleLogout} data-testid="admin-logout-btn">
            <LogOut size={20} className="mr-2" />
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold" data-testid="stats-total-users">{stats.total_users || 0}</p>
                </div>
                <Users className="text-[#E23744]" size={32} />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold" data-testid="stats-active-users">{stats.active_users || 0}</p>
                </div>
                <Users className="text-[#239D60]" size={32} />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Orders Today</p>
                  <p className="text-2xl font-bold" data-testid="stats-orders-today">{stats.orders_today || 0}</p>
                </div>
                <ShoppingBag className="text-[#F59E0B]" size={32} />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Points Issued</p>
                  <p className="text-2xl font-bold" data-testid="stats-points-issued">{stats.points_issued || 0}</p>
                </div>
                <Gift className="text-[#3B82F6]" size={32} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="verifications" data-testid="admin-tabs">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="verifications">Verifications</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* Verifications Tab */}
          <TabsContent value="verifications">
            <Card>
              <CardHeader>
                <CardTitle>Pending Student ID Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingVerifications.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No pending verifications</p>
                ) : (
                  <div className="space-y-4" data-testid="verifications-list">
                    {pendingVerifications.map((verification) => (
                      <div key={verification.id} className="border rounded-lg p-4" data-testid={`verification-${verification.id}`}>
                        <div className="flex items-start gap-4">
                          {/* Student ID Image */}
                          {verification.image_data && (
                            <div className="flex-shrink-0">
                              <p className="text-xs font-semibold text-gray-500 mb-1">Student ID Photo:</p>
                              <img 
                                src={`data:image/jpeg;base64,${verification.image_data}`}
                                alt="Student ID"
                                className="w-48 h-auto rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  // Open image in new tab for full view
                                  const win = window.open();
                                  win.document.write(`<img src="data:image/jpeg;base64,${verification.image_data}" style="max-width:100%;" />`);
                                }}
                                data-testid={`verification-image-${verification.id}`}
                              />
                              <p className="text-xs text-gray-400 mt-1">Click to enlarge</p>
                            </div>
                          )}
                          
                          {/* Verification Details */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold">{verification.user_name || 'Unknown User'}</p>
                                <p className="text-sm text-gray-500">{verification.user_phone}</p>
                                <p className="text-xs text-gray-400 mt-1">User ID: {verification.user_id}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApproveVerification(verification.id)}
                                  data-testid={`approve-verification-${verification.id}`}
                                >
                                  <Check size={16} className="mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectVerification(verification.id)}
                                  data-testid={`reject-verification-${verification.id}`}
                                >
                                  <X size={16} className="mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                            
                            {/* OCR Results */}
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div className="p-2 bg-blue-50 rounded">
                                <p className="text-xs font-semibold text-blue-700">User Provided DOB:</p>
                                <p className="text-sm">{verification.user_provided_dob || 'N/A'}</p>
                              </div>
                              <div className="p-2 bg-green-50 rounded">
                                <p className="text-xs font-semibold text-green-700">OCR Detected DOB:</p>
                                <p className="text-sm">{verification.ocr_extracted_dob || 'Not detected'}</p>
                              </div>
                              <div className="p-2 bg-purple-50 rounded col-span-2">
                                <p className="text-xs font-semibold text-purple-700">DOB Match:</p>
                                <p className={`text-sm font-bold ${verification.dob_match === true ? 'text-green-600' : verification.dob_match === false ? 'text-red-600' : 'text-gray-500'}`}>
                                  {verification.dob_match === true ? '✓ Matched' : verification.dob_match === false ? '✗ Not Matched' : 'Unable to verify'}
                                </p>
                              </div>
                            </div>
                            
                            {/* Extracted Text */}
                            <div className="mt-3 p-3 bg-gray-50 rounded text-sm max-h-32 overflow-y-auto">
                              <p className="font-semibold mb-1 text-gray-700">OCR Extracted Text:</p>
                              <p className="text-gray-600 whitespace-pre-wrap text-xs">{verification.extracted_text || 'No text extracted'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="text-[#E23744]" size={24} />
                  User Management
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">Manage all users and student verifications</p>
              </CardHeader>
              <CardContent>
                {/* User Type Tabs */}
                <div className="flex gap-2 mb-4 border-b pb-3">
                  <Button
                    variant={userTypeTab === 'students' ? 'default' : 'outline'}
                    onClick={() => setUserTypeTab('students')}
                    className={userTypeTab === 'students' ? 'bg-[#E23744] hover:bg-[#c42f3c]' : ''}
                    data-testid="tab-student-users"
                  >
                    <GraduationCap size={18} className="mr-2" />
                    Student Users ({studentUsers.length})
                  </Button>
                  <Button
                    variant={userTypeTab === 'normal' ? 'default' : 'outline'}
                    onClick={() => setUserTypeTab('normal')}
                    className={userTypeTab === 'normal' ? 'bg-[#E23744] hover:bg-[#c42f3c]' : ''}
                    data-testid="tab-normal-users"
                  >
                    <User size={18} className="mr-2" />
                    Normal Users ({normalUsers.length})
                  </Button>
                </div>

                {/* Student Users Section */}
                {userTypeTab === 'students' && (
                  <div className="space-y-4">
                    {/* Filter Buttons */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <Filter size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-600 mr-2">Filter:</span>
                      {['all', 'verified', 'pending', 'rejected', 'not_applied'].map((filter) => (
                        <Button
                          key={filter}
                          size="sm"
                          variant={studentFilter === filter ? 'default' : 'outline'}
                          onClick={() => setStudentFilter(filter)}
                          className={studentFilter === filter ? 'bg-[#E23744] hover:bg-[#c42f3c]' : ''}
                          data-testid={`filter-${filter}`}
                        >
                          {filter === 'all' && 'All'}
                          {filter === 'verified' && '✓ Verified'}
                          {filter === 'pending' && '⏳ Pending'}
                          {filter === 'rejected' && '✗ Rejected'}
                          {filter === 'not_applied' && 'Not Applied'}
                        </Button>
                      ))}
                    </div>

                    {/* Student Users List */}
                    <div className="space-y-3" data-testid="student-users-list">
                      {getFilteredStudentUsers().length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <GraduationCap size={48} className="mx-auto mb-3 text-gray-300" />
                          <p>No student users found with this filter</p>
                        </div>
                      ) : (
                        getFilteredStudentUsers().map((user) => (
                          <div 
                            key={user.id} 
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            data-testid={`student-user-${user.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-lg">{user.name}</p>
                                  {getVerificationStatusBadge(user.verification_status)}
                                  {user.loyalty_active && (
                                    <Badge className="bg-purple-100 text-purple-800">Loyalty Active</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{user.phone_number}</p>
                                {user.college && (
                                  <p className="text-sm text-gray-500">{user.college}</p>
                                )}
                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                  {user.dob && (
                                    <span>DOB: {new Date(user.dob).toLocaleDateString()} (Age: {calculateAge(user.dob)})</span>
                                  )}
                                  <span>Points: {user.points || 0}</span>
                                  <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                                </div>
                                {user.rejection_reason && (
                                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                    <AlertCircle size={14} />
                                    {user.rejection_reason}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserModal(true);
                                  }}
                                  data-testid={`view-user-${user.id}`}
                                >
                                  <Eye size={16} className="mr-1" />
                                  View
                                </Button>
                                {user.verification_status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => {
                                        // Find the verification for this user
                                        const verification = pendingVerifications.find(v => v.user_id === user.id);
                                        if (verification) {
                                          handleApproveVerification(verification.id);
                                        } else {
                                          toast.error('Verification record not found');
                                        }
                                      }}
                                      data-testid={`approve-user-${user.id}`}
                                    >
                                      <Check size={16} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        const verification = pendingVerifications.find(v => v.user_id === user.id);
                                        if (verification) {
                                          handleRejectVerification(verification.id);
                                        } else {
                                          toast.error('Verification record not found');
                                        }
                                      }}
                                      data-testid={`reject-user-${user.id}`}
                                    >
                                      <X size={16} />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deletingUserId === user.id}
                                  data-testid={`delete-user-${user.id}`}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Normal Users Section */}
                {userTypeTab === 'normal' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Normal users can order food but have not opted into the student loyalty program.
                    </p>
                    
                    {/* Normal Users List */}
                    <div className="space-y-3" data-testid="normal-users-list">
                      {normalUsers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <User size={48} className="mx-auto mb-3 text-gray-300" />
                          <p>No normal users found</p>
                        </div>
                      ) : (
                        normalUsers.map((user) => (
                          <div 
                            key={user.id} 
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            data-testid={`normal-user-${user.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-lg">{user.name}</p>
                                  <Badge className="bg-blue-100 text-blue-800">Normal User</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{user.phone_number}</p>
                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                  <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                                  {user.last_visit && (
                                    <span>Last Visit: {new Date(user.last_visit).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserModal(true);
                                  }}
                                  data-testid={`view-normal-user-${user.id}`}
                                >
                                  <Eye size={16} className="mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deletingUserId === user.id}
                                  data-testid={`delete-normal-user-${user.id}`}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="user-details-modal">
                <Card className="w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {selectedUser.is_student ? <GraduationCap size={24} /> : <User size={24} />}
                        User Details
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowUserModal(false);
                          setSelectedUser(null);
                        }}
                      >
                        <X size={20} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-500">Name</Label>
                        <p className="font-semibold">{selectedUser.name}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Phone</Label>
                        <p className="font-semibold">{selectedUser.phone_number}</p>
                      </div>
                      {selectedUser.college && (
                        <div>
                          <Label className="text-gray-500">College</Label>
                          <p className="font-semibold">{selectedUser.college}</p>
                        </div>
                      )}
                      {selectedUser.dob && (
                        <div>
                          <Label className="text-gray-500">Date of Birth</Label>
                          <p className="font-semibold">
                            {new Date(selectedUser.dob).toLocaleDateString()} 
                            <span className="text-gray-500 ml-2">(Age: {calculateAge(selectedUser.dob)})</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Status Info */}
                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-500">Account Type</Label>
                          <div className="mt-1">
                            {selectedUser.is_student ? (
                              <Badge className="bg-purple-100 text-purple-800">Student</Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800">Normal User</Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-gray-500">Verification Status</Label>
                          <div className="mt-1">
                            {getVerificationStatusBadge(selectedUser.verification_status)}
                          </div>
                        </div>
                        {selectedUser.is_student && (
                          <>
                            <div>
                              <Label className="text-gray-500">Loyalty Status</Label>
                              <div className="mt-1">
                                {selectedUser.loyalty_active ? (
                                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                                ) : (
                                  <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                                )}
                              </div>
                            </div>
                            <div>
                              <Label className="text-gray-500">Points</Label>
                              <p className="font-semibold text-lg">{selectedUser.points || 0}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Rejection Reason */}
                    {selectedUser.rejection_reason && (
                      <div className="border-t pt-4">
                        <Label className="text-gray-500">Rejection Reason</Label>
                        <p className="text-red-600 bg-red-50 p-3 rounded mt-1">
                          {selectedUser.rejection_reason}
                        </p>
                      </div>
                    )}

                    {/* Activity Info */}
                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-gray-500">Created</Label>
                          <p>{new Date(selectedUser.created_at).toLocaleString()}</p>
                        </div>
                        {selectedUser.last_visit && (
                          <div>
                            <Label className="text-gray-500">Last Visit</Label>
                            <p>{new Date(selectedUser.last_visit).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t pt-4 flex flex-wrap gap-2">
                      {selectedUser.is_student && selectedUser.loyalty_active && (
                        <Button
                          variant="outline"
                          onClick={() => handleDisableLoyalty(selectedUser.id)}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          Disable Loyalty
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteUser(selectedUser.id)}
                        disabled={deletingUserId === selectedUser.id}
                        data-testid="modal-delete-user"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Delete User
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu">
            <div className="space-y-4">
              {/* PDF Menu Upload */}
              <Card>
                <CardHeader>
                  <CardTitle>Menu PDF Upload (Primary)</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Upload your complete menu as PDF - fast and easy</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePDFUpload}
                        className="hidden"
                        id="pdf-upload"
                        disabled={uploadingPDF}
                      />
                      <div className="text-center">
                        <Upload className="mx-auto mb-3 text-gray-400" size={48} />
                        <p className="text-sm text-gray-600 mb-3">
                          Click to upload your menu PDF
                        </p>
                        <Button
                          onClick={() => document.getElementById('pdf-upload').click()}
                          disabled={uploadingPDF}
                          className="btn-primary"
                          data-testid="upload-pdf-btn"
                        >
                          {uploadingPDF ? 'Uploading...' : 'Choose PDF File'}
                        </Button>
                      </div>
                    </div>

                    {/* Uploaded PDFs List */}
                    {menuPDFs.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Uploaded Menu PDFs</h4>
                        {menuPDFs.map((pdf) => (
                          <div key={pdf.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-semibold">{pdf.filename}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(pdf.uploaded_at).toLocaleString()}
                              </p>
                              {pdf.active && (
                                <Badge className="mt-1 bg-green-100 text-green-800">Active</Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`${API}/menu-pdf/download/${pdf.id}`, '_blank')}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeletePDF(pdf.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Manual Menu Item Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Manual Menu Items (Override)</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Add or edit individual items - these override PDF</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddMenuItem} className="space-y-4 mb-6" data-testid="add-menu-form">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Item Name</Label>
                        <Input
                          value={newMenuItem.name}
                          onChange={(e) => setNewMenuItem({...newMenuItem, name: e.target.value})}
                          required
                          data-testid="menu-name-input"
                        />
                      </div>
                      <div>
                        <Label>Price (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newMenuItem.price}
                          onChange={(e) => setNewMenuItem({...newMenuItem, price: e.target.value})}
                          required
                          data-testid="menu-price-input"
                        />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Input
                          value={newMenuItem.category}
                          onChange={(e) => setNewMenuItem({...newMenuItem, category: e.target.value})}
                          required
                          data-testid="menu-category-input"
                        />
                      </div>
                      <div>
                        <Label>Prep Time (mins)</Label>
                        <Input
                          type="number"
                          value={newMenuItem.prep_time}
                          onChange={(e) => setNewMenuItem({...newMenuItem, prep_time: e.target.value})}
                          required
                          data-testid="menu-prep-time-input"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={newMenuItem.veg ? 'veg' : 'non-veg'}
                        onValueChange={(value) => setNewMenuItem({...newMenuItem, veg: value === 'veg'})}
                      >
                        <SelectTrigger data-testid="menu-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="veg">Vegetarian</SelectItem>
                          <SelectItem value="non-veg">Non-Vegetarian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="btn-primary" data-testid="add-menu-item-btn">
                      <Plus size={16} className="mr-2" />
                      Add Item (Manual Override)
                    </Button>
                  </form>

                  {/* Menu Items List */}
                  <div className="space-y-3" data-testid="menu-items-list">
                    {menuItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`menu-item-${item.id}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{item.name}</p>
                            {item.is_manual_override && (
                              <Badge variant="secondary" className="text-xs">Manual</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">₹{item.price} | {item.category} | {item.prep_time} mins</p>
                          <Badge variant={item.veg ? 'default' : 'secondary'} className="mt-1">
                            {item.veg ? 'Veg' : 'Non-Veg'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteMenuItem(item.id)}
                          data-testid={`delete-menu-item-${item.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="text-[#E23744]" size={24} />
                  Order Management
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">View and manage all customer orders</p>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="orders-list">
                    {orders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid={`order-${order.id}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-lg">Order #{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-gray-600">{new Date(order.created_at).toLocaleString()}</p>
                            {order.user_name && (
                              <p className="text-sm text-gray-700 mt-1">
                                <span className="font-medium">{order.user_name}</span>
                                {order.user_phone && <span className="text-gray-500 ml-2">({order.user_phone})</span>}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-xl text-[#E23744]">₹{order.final_amount?.toFixed(2) || '0.00'}</p>
                          </div>
                        </div>
                        
                        {/* Order Items */}
                        <div className="bg-gray-50 rounded p-3 mb-3">
                          <p className="text-xs text-gray-500 mb-2">Items:</p>
                          {order.items?.map((item, idx) => (
                            <p key={idx} className="text-sm">
                              <span className="font-medium">{item.quantity}x</span> {item.name || item.menu_item_id}
                              <span className="text-gray-500 ml-2">₹{(item.price * item.quantity).toFixed(2)}</span>
                            </p>
                          ))}
                        </div>
                        
                        {/* Delivery Address */}
                        <p className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Delivery:</span> {order.delivery_address}
                        </p>
                        
                        {/* Order Summary */}
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                          <span>Subtotal: ₹{order.total_amount?.toFixed(2)}</span>
                          <span>|</span>
                          <span>Delivery: ₹{order.delivery_fee?.toFixed(2)}</span>
                          {order.discount > 0 && (
                            <>
                              <span>|</span>
                              <span className="text-green-600">Discount: -₹{order.discount?.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                        
                        {/* Status Update */}
                        <div className="flex items-center gap-3 pt-3 border-t">
                          <span className="text-sm text-gray-600">Status:</span>
                          <Select
                            value={order.status}
                            onValueChange={async (newStatus) => {
                              try {
                                const token = localStorage.getItem('token');
                                await axios.put(`${API}/admin/orders/${order.id}/status?status=${newStatus}`, {}, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
                                fetchDashboardData();
                              } catch (error) {
                                toast.error('Failed to update order status');
                              }
                            }}
                          >
                            <SelectTrigger className="w-40" data-testid={`order-status-select-${order.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                  Pending
                                </span>
                              </SelectItem>
                              <SelectItem value="confirmed">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  Confirmed
                                </span>
                              </SelectItem>
                              <SelectItem value="preparing">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                  Preparing
                                </span>
                              </SelectItem>
                              <SelectItem value="out_for_delivery">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                  Out for Delivery
                                </span>
                              </SelectItem>
                              <SelectItem value="delivered">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                  Delivered
                                </span>
                              </SelectItem>
                              <SelectItem value="cancelled">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                  Cancelled
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons Tab */}
          <TabsContent value="coupons">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Create Coupon</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateCoupon} className="space-y-4" data-testid="create-coupon-form">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Coupon Code</Label>
                        <Input
                          value={newCoupon.code}
                          onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                          required
                          data-testid="coupon-code-input"
                        />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={newCoupon.type}
                          onValueChange={(value) => setNewCoupon({...newCoupon, type: value})}
                        >
                          <SelectTrigger data-testid="coupon-type-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat Discount</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Value</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newCoupon.value}
                          onChange={(e) => setNewCoupon({...newCoupon, value: e.target.value})}
                          required
                          data-testid="coupon-value-input"
                        />
                      </div>
                      <div>
                        <Label>Min Order Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newCoupon.min_order}
                          onChange={(e) => setNewCoupon({...newCoupon, min_order: e.target.value})}
                          data-testid="coupon-min-order-input"
                        />
                      </div>
                      <div>
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={newCoupon.expiry_date}
                          onChange={(e) => setNewCoupon({...newCoupon, expiry_date: e.target.value})}
                          required
                          data-testid="coupon-expiry-input"
                        />
                      </div>
                      <div>
                        <Label>Usage Limit</Label>
                        <Input
                          type="number"
                          value={newCoupon.usage_limit}
                          onChange={(e) => setNewCoupon({...newCoupon, usage_limit: e.target.value})}
                          required
                          data-testid="coupon-usage-limit-input"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="btn-primary" data-testid="create-coupon-btn">
                      Create Coupon
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Existing Coupons List */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Coupons</CardTitle>
                </CardHeader>
                <CardContent>
                  {coupons.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No coupons created yet</p>
                  ) : (
                    <div className="space-y-3" data-testid="coupons-list">
                      {coupons.map((coupon) => {
                        const isExpired = new Date(coupon.expiry_date) < new Date();
                        const isExhausted = coupon.used_count >= coupon.usage_limit;
                        return (
                          <div 
                            key={coupon.id} 
                            className={`border rounded-lg p-4 ${isExpired || isExhausted || !coupon.active ? 'bg-gray-50 opacity-60' : ''}`}
                            data-testid={`coupon-item-${coupon.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-lg">{coupon.code}</p>
                                  {coupon.type === 'flat' ? (
                                    <Badge className="bg-green-100 text-green-800">₹{coupon.value} OFF</Badge>
                                  ) : (
                                    <Badge className="bg-blue-100 text-blue-800">{coupon.value}% OFF</Badge>
                                  )}
                                  {isExpired && <Badge className="bg-red-100 text-red-800">Expired</Badge>}
                                  {isExhausted && <Badge className="bg-yellow-100 text-yellow-800">Exhausted</Badge>}
                                  {!coupon.active && <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>}
                                </div>
                                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                  <span>Min Order: ₹{coupon.min_order}</span>
                                  <span>Used: {coupon.used_count}/{coupon.usage_limit}</span>
                                  <span>Expires: {new Date(coupon.expiry_date).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  if (!window.confirm('Delete this coupon?')) return;
                                  try {
                                    const token = localStorage.getItem('token');
                                    await axios.delete(`${API}/admin/coupons/${coupon.id}`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    toast.success('Coupon deleted');
                                    fetchDashboardData();
                                  } catch (error) {
                                    toast.error('Failed to delete coupon');
                                  }
                                }}
                                data-testid={`delete-coupon-${coupon.id}`}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <Card>
              <CardHeader>
                <CardTitle>Edit About Page</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateAbout} className="space-y-4" data-testid="edit-about-form">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={aboutContent.title}
                      onChange={(e) => setAboutContent({...aboutContent, title: e.target.value})}
                      data-testid="about-title-input"
                    />
                  </div>
                  <div>
                    <Label>Content</Label>
                    <Textarea
                      rows={10}
                      value={aboutContent.content}
                      onChange={(e) => setAboutContent({...aboutContent, content: e.target.value})}
                      data-testid="about-content-input"
                    />
                  </div>
                  <Button type="submit" className="btn-primary" data-testid="update-about-btn">
                    Update About Content
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="space-y-4">
              {/* Business Identity */}
              <Card>
                <CardHeader>
                  <CardTitle>Business Identity</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateSettings} className="space-y-4" data-testid="settings-form">
                    <div>
                      <Label>Business Name</Label>
                      <Input
                        value={settings.shop_name}
                        onChange={(e) => setSettings({...settings, shop_name: e.target.value})}
                        data-testid="shop-name-input"
                        placeholder="Thu.Go.Zi – Food on Truck"
                      />
                    </div>
                    <div>
                      <Label>Tagline</Label>
                      <Input
                        value={settings.shop_tagline}
                        onChange={(e) => setSettings({...settings, shop_tagline: e.target.value})}
                        data-testid="shop-tagline-input"
                        placeholder="Fresh food delivered from our food truck"
                      />
                    </div>
                    <Button type="submit" className="btn-primary" data-testid="update-settings-btn">
                      Update Business Identity
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Shop Location */}
              <Card>
                <CardHeader>
                  <CardTitle>Shop Location (Critical for Delivery)</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Set your exact location - all delivery calculations use this</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Google Maps Location Picker */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-semibold mb-2 text-sm">Option 1: Google Maps (Recommended)</h3>
                    <LocationPicker
                      initialLat={settings.shop_latitude}
                      initialLng={settings.shop_longitude}
                      onLocationSelect={(location) => {
                        setSettings({
                          ...settings,
                          shop_latitude: location.lat,
                          shop_longitude: location.lng,
                          shop_address: location.address
                        });
                      }}
                    />
                  </div>

                  {/* Manual Input Fallback */}
                  <div className="border rounded-lg p-4 bg-white">
                    <h3 className="font-semibold mb-3 text-sm">Option 2: Manual Entry (Fallback)</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Shop Address</Label>
                        <Input
                          value={settings.shop_address}
                          onChange={(e) => setSettings({...settings, shop_address: e.target.value})}
                          placeholder="Complete address"
                          data-testid="manual-address-input"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Latitude</Label>
                          <Input
                            type="number"
                            step="0.000001"
                            value={settings.shop_latitude}
                            onChange={(e) => setSettings({...settings, shop_latitude: parseFloat(e.target.value)})}
                            placeholder="28.6139"
                            data-testid="manual-lat-input"
                          />
                        </div>
                        <div>
                          <Label>Longitude</Label>
                          <Input
                            type="number"
                            step="0.000001"
                            value={settings.shop_longitude}
                            onChange={(e) => setSettings({...settings, shop_longitude: parseFloat(e.target.value)})}
                            placeholder="77.2090"
                            data-testid="manual-lng-input"
                          />
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs text-blue-800">
                          💡 Get coordinates: Open Google Maps → Right-click location → Copy coordinates
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleUpdateSettings} 
                    className="btn-primary w-full"
                    data-testid="save-location-btn"
                  >
                    💾 Save Location
                  </Button>
                </CardContent>
              </Card>

              {/* Delivery Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div>
                      <Label>Delivery Charge (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={settings.delivery_charge}
                        onChange={(e) => setSettings({...settings, delivery_charge: e.target.value})}
                        data-testid="delivery-charge-input"
                      />
                    </div>
                    <div>
                      <Label>Delivery Radius (km)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={settings.delivery_radius_km}
                        onChange={(e) => setSettings({...settings, delivery_radius_km: parseFloat(e.target.value)})}
                        data-testid="delivery-radius-input"
                      />
                      <p className="text-xs text-gray-500 mt-1">Orders beyond this radius will be pickup-only</p>
                    </div>
                    <div>
                      <Label>Payment Information</Label>
                      <Textarea
                        rows={3}
                        value={settings.payment_info}
                        onChange={(e) => setSettings({...settings, payment_info: e.target.value})}
                        data-testid="payment-info-input"
                        placeholder="Cash on Delivery only"
                      />
                    </div>
                    <Button type="submit" className="btn-primary">
                      Update Delivery Settings
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Loyalty Expiry Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock size={20} className="text-purple-600" />
                    Automatic Loyalty Expiry
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Students automatically lose loyalty benefits when they turn 24. This check runs daily at server startup.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={handleTriggerExpiryCheck}
                      disabled={runningExpiryCheck}
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      data-testid="trigger-expiry-check-btn"
                    >
                      <RefreshCw size={16} className={`mr-2 ${runningExpiryCheck ? 'animate-spin' : ''}`} />
                      {runningExpiryCheck ? 'Checking...' : 'Run Expiry Check Now'}
                    </Button>
                    <span className="text-sm text-gray-500">
                      Last auto-check: Server startup
                    </span>
                  </div>

                  {/* Expiry Logs */}
                  {loyaltyExpiryLogs.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-3">Recent Expiry Activity</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {loyaltyExpiryLogs.filter(log => log.action === 'loyalty_auto_expired').map((log) => (
                          <div key={log.id} className="flex items-center justify-between p-2 bg-purple-50 rounded text-sm">
                            <div>
                              <span className="font-medium">{log.details?.user_name || 'Unknown User'}</span>
                              <span className="text-gray-500 ml-2">
                                Age {log.details?.age} (DOB: {log.details?.dob})
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {loyaltyExpiryLogs.filter(log => log.action === 'loyalty_auto_expired').length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-2">
                            No automatic expirations recorded yet
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account">
            <div className="space-y-4">
              {/* Admin Account Security */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Security</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Manage your admin credentials</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Button
                      onClick={() => setShowPasswordModal(true)}
                      variant="outline"
                      className="w-full sm:w-auto"
                      data-testid="change-password-btn"
                    >
                      Change Password
                    </Button>
                  </div>
                  <div>
                    <Button
                      onClick={() => setShowUsernameModal(true)}
                      variant="outline"
                      className="w-full sm:w-auto"
                      data-testid="change-username-btn"
                    >
                      Change Username
                    </Button>
                  </div>

                  {/* Password Change Modal */}
                  {showPasswordModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <Card className="w-full max-w-md m-4">
                        <CardHeader>
                          <CardTitle>Change Password</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                              <Label>Current Password</Label>
                              <Input
                                type="password"
                                value={passwordForm.current_password}
                                onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                                required
                                data-testid="current-password-input"
                              />
                            </div>
                            <div>
                              <Label>New Password</Label>
                              <Input
                                type="password"
                                value={passwordForm.new_password}
                                onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                                required
                                minLength={6}
                                data-testid="new-password-input"
                              />
                            </div>
                            <div>
                              <Label>Confirm New Password</Label>
                              <Input
                                type="password"
                                value={passwordForm.confirm_password}
                                onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                                required
                                minLength={6}
                                data-testid="confirm-password-input"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" className="btn-primary" data-testid="submit-password-btn">
                                Change Password
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setShowPasswordModal(false);
                                  setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                                }}
                                data-testid="cancel-password-btn"
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Username Change Modal */}
                  {showUsernameModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <Card className="w-full max-w-md m-4">
                        <CardHeader>
                          <CardTitle>Change Username</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">You will be logged out after changing username</p>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={handleChangeUsername} className="space-y-4">
                            <div>
                              <Label>New Username</Label>
                              <Input
                                type="text"
                                value={usernameForm.new_username}
                                onChange={(e) => setUsernameForm({...usernameForm, new_username: e.target.value})}
                                required
                                data-testid="new-username-input"
                              />
                            </div>
                            <div>
                              <Label>Current Password (for verification)</Label>
                              <Input
                                type="password"
                                value={usernameForm.password}
                                onChange={(e) => setUsernameForm({...usernameForm, password: e.target.value})}
                                required
                                data-testid="verify-password-input"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" className="btn-primary" data-testid="submit-username-btn">
                                Change Username
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setShowUsernameModal(false);
                                  setUsernameForm({ new_username: '', password: '' });
                                }}
                                data-testid="cancel-username-btn"
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Tips */}
              <Card>
                <CardHeader>
                  <CardTitle>Security Best Practices</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>✓ Use a strong password with at least 8 characters</li>
                    <li>✓ Include uppercase, lowercase, numbers, and symbols</li>
                    <li>✓ Do not share your admin credentials with anyone</li>
                    <li>✓ Change your password regularly</li>
                    <li>✓ Log out when using shared computers</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
