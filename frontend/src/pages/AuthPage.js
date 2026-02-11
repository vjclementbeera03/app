import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, User, Loader2, Shield, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { sendOTP, verifyOTP, firebaseSignOut, clearRecaptcha, setupRecaptcha, getIdToken, getCurrentUser } from '@/lib/firebase';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const AuthPage = () => {
  const [step, setStep] = useState('phone'); // phone, otp, register, admin
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otpCode, setOtpCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const [recaptchaLoading, setRecaptchaLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const isMounted = useRef(true);
  const recaptchaInitialized = useRef(false);

  // Check for existing Firebase auth on mount (resume interrupted registration)
  useEffect(() => {
    const checkExistingSession = async () => {
      const user = getCurrentUser();
      if (user && user.phoneNumber) {
        console.log('Found existing Firebase session for:', user.phoneNumber);
        try {
          // Check if user exists in backend
          const idToken = await getIdToken();
          if (idToken) {
            const response = await axios.post(`${API}/auth/firebase`, {
              firebase_token: idToken
            });
            
            if (response.data.is_new_user) {
              // User authenticated but not registered - show registration form
              setStep('register');
              toast.info('Please complete your registration');
            } else {
              // User already registered - log them in
              login(response.data.token, response.data.user);
              toast.success('Welcome back!');
              navigate('/dashboard');
            }
          }
        } catch (error) {
          console.log('No valid session found, starting fresh');
          // Session invalid, start fresh
          await firebaseSignOut();
        }
      }
    };
    
    checkExistingSession();
  }, [login, navigate]);

  // Initialize reCAPTCHA
  const initRecaptcha = useCallback(async () => {
    if (recaptchaInitialized.current || recaptchaLoading) return;
    
    setRecaptchaLoading(true);
    setErrorMessage('');
    
    try {
      await setupRecaptcha(
        // onVerified callback
        () => {
          if (isMounted.current) {
            setRecaptchaVerified(true);
            setErrorMessage('');
          }
        },
        // onError callback
        (error) => {
          if (isMounted.current) {
            setRecaptchaVerified(false);
            if (error === 'expired') {
              setErrorMessage('reCAPTCHA expired. Please verify again.');
            }
          }
        }
      );
      recaptchaInitialized.current = true;
    } catch (error) {
      console.error('Failed to initialize reCAPTCHA:', error);
      if (isMounted.current) {
        setErrorMessage('Failed to load reCAPTCHA. Please refresh the page.');
      }
    } finally {
      if (isMounted.current) {
        setRecaptchaLoading(false);
      }
    }
  }, [recaptchaLoading]);

  // Initialize reCAPTCHA when on phone step
  useEffect(() => {
    isMounted.current = true;
    
    if (step === 'phone' && !isAdmin && !recaptchaInitialized.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initRecaptcha();
      }, 300);
      
      return () => clearTimeout(timer);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [step, isAdmin, initRecaptcha]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRecaptcha();
      recaptchaInitialized.current = false;
    };
  }, []);

  // Resend timer countdown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const formatPhoneNumber = () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return `${countryCode}${cleaned}`;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    if (!recaptchaVerified) {
      toast.error('Please complete the reCAPTCHA verification first');
      return;
    }
    
    if (loading) return;
    
    setLoading(true);

    try {
      const fullPhone = formatPhoneNumber();
      console.log('Sending OTP to:', fullPhone);
      
      const result = await sendOTP(fullPhone);
      
      if (!isMounted.current) return;
      
      if (result.success) {
        toast.success('OTP sent to your phone!');
        setStep('otp');
        setResendTimer(30);
        setErrorMessage('');
      } else {
        // Show detailed error for debugging
        const errorText = result.originalError 
          ? `${result.message} (${result.code}: ${result.originalError})`
          : result.message;
        setErrorMessage(errorText);
        toast.error(result.message);
        
        // If it's a reCAPTCHA-related error, reset it
        if (result.code?.includes('captcha') || result.code?.includes('verifier')) {
          recaptchaInitialized.current = false;
          setRecaptchaVerified(false);
          clearRecaptcha();
          setTimeout(() => initRecaptcha(), 500);
        }
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      if (isMounted.current) {
        setErrorMessage(`Unexpected error: ${error.message}`);
        toast.error('Failed to send OTP. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0 || loading) return;
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      // Reset everything for resend
      clearRecaptcha();
      recaptchaInitialized.current = false;
      setRecaptchaVerified(false);
      setStep('phone');
      
      toast.info('Please complete the reCAPTCHA and click Send OTP again');
      
      // Re-initialize reCAPTCHA
      setTimeout(() => initRecaptcha(), 500);
    } catch (error) {
      console.error('Resend error:', error);
      if (isMounted.current) {
        setErrorMessage(`Reset failed: ${error.message}`);
        toast.error('Failed to reset. Please refresh the page.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleVerifyOTP = useCallback(async (e) => {
    e?.preventDefault();
    
    if (otpCode.length !== 6 || loading) return;
    
    setLoading(true);

    try {
      const result = await verifyOTP(otpCode);
      
      if (!isMounted.current) return;
      
      if (result.success) {
        // Send Firebase token to backend
        const response = await axios.post(`${API}/auth/firebase`, {
          firebase_token: result.idToken
        });

        if (response.data.is_new_user) {
          setStep('register');
        } else {
          login(response.data.token, response.data.user);
          toast.success('Logged in successfully!');
          navigate('/dashboard');
        }
      } else {
        toast.error(result.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      if (isMounted.current) {
        toast.error(error.response?.data?.detail || 'Verification failed');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [otpCode, loading, login, navigate]);

  // Auto-submit when OTP is complete
  useEffect(() => {
    if (otpCode.length === 6 && step === 'otp' && !loading) {
      handleVerifyOTP();
    }
  }, [otpCode, step, loading, handleVerifyOTP]);

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || loading) return;
    
    setLoading(true);

    try {
      const { getIdToken } = await import('@/lib/firebase');
      const idToken = await getIdToken();
      
      if (!idToken) {
        toast.error('Session expired. Please start again.');
        resetFlow();
        return;
      }
      
      const response = await axios.post(`${API}/auth/firebase`, {
        firebase_token: idToken,
        name: name.trim()
      });

      login(response.data.token, response.data.user);
      toast.success('Registration successful!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Register error:', error);
      if (isMounted.current) {
        toast.error(error.response?.data?.detail || 'Registration failed');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);

    try {
      const response = await axios.post(`${API}/admin/login`, {
        username: adminUsername,
        password: adminPassword
      });

      login(response.data.token, response.data.admin, 'admin');
      toast.success('Admin login successful');
      navigate('/admin');
    } catch (error) {
      if (isMounted.current) {
        toast.error(error.response?.data?.detail || 'Invalid credentials');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const resetFlow = async () => {
    await firebaseSignOut();
    clearRecaptcha();
    recaptchaInitialized.current = false;
    setStep('phone');
    setOtpCode('');
    setResendTimer(0);
    setRecaptchaVerified(false);
    setErrorMessage('');
    
    // Re-initialize reCAPTCHA
    setTimeout(() => initRecaptcha(), 500);
  };

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-[#E23744] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="text-white" size={32} />
            </div>
            <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Admin Login
            </CardTitle>
            <CardDescription>Enter your admin credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="mt-1.5"
                  data-testid="admin-username-input"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="mt-1.5"
                  data-testid="admin-password-input"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-[#E23744] hover:bg-[#c42f3c] h-12 text-base font-semibold"
                disabled={loading}
                data-testid="admin-login-submit-btn"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                Login
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsAdmin(false)}
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to User Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E23744] to-[#c42f3c] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-[#E23744] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Phone className="text-white" size={32} />
          </div>
          <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Welcome to Thu.Go.Zi
          </CardTitle>
          <CardDescription className="text-gray-600">
            {step === 'phone' && 'Enter your phone number to continue'}
            {step === 'otp' && 'Enter the verification code'}
            {step === 'register' && 'Complete your profile'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              {/* Error Message Display */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}
              
              <div>
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <div className="flex gap-2 mt-1.5">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-28 px-3 py-2.5 border rounded-lg bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#E23744]/20"
                    data-testid="country-code-select"
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+61">🇦🇺 +61</option>
                  </select>
                  <div className="flex-1 relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      className="pl-10 h-11"
                      placeholder="Enter phone number"
                      required
                      maxLength={10}
                      data-testid="phone-number-input"
                    />
                  </div>
                </div>
              </div>
              
              {/* Visible reCAPTCHA */}
              <div className="flex flex-col items-center space-y-3">
                {recaptchaLoading && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Loading reCAPTCHA...</span>
                  </div>
                )}
                <div id="recaptcha-container" className="flex justify-center"></div>
                {recaptchaVerified && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle size={16} />
                    <span>Verified! You can now send OTP</span>
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-[#E23744] hover:bg-[#c42f3c] h-12 text-base font-semibold shadow-md"
                disabled={loading || phoneNumber.length < 10 || !recaptchaVerified}
                data-testid="send-otp-btn"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                {loading ? 'Sending OTP...' : (!recaptchaVerified ? 'Complete reCAPTCHA first' : 'Send OTP')}
              </Button>
              
              {!recaptchaVerified && !recaptchaLoading && (
                <p className="text-xs text-center text-gray-500">
                  Complete the "I'm not a robot" verification above to continue
                </p>
              )}
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-medium text-center block">
                  Verification Code
                </Label>
                <p className="text-sm text-gray-500 text-center">
                  We sent a 6-digit code to <span className="font-semibold text-gray-700">{countryCode} {phoneNumber}</span>
                </p>
                
                {/* Shadcn OTP Input */}
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(value) => setOtpCode(value)}
                    data-testid="otp-input"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="w-12 h-14 text-xl font-bold border-2 rounded-lg" />
                      <InputOTPSlot index={1} className="w-12 h-14 text-xl font-bold border-2 rounded-lg" />
                      <InputOTPSlot index={2} className="w-12 h-14 text-xl font-bold border-2 rounded-lg" />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="w-12 h-14 text-xl font-bold border-2 rounded-lg" />
                      <InputOTPSlot index={4} className="w-12 h-14 text-xl font-bold border-2 rounded-lg" />
                      <InputOTPSlot index={5} className="w-12 h-14 text-xl font-bold border-2 rounded-lg" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {/* Resend OTP */}
                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend code in <span className="font-semibold text-[#E23744]">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={loading}
                      className="text-sm font-semibold text-[#E23744] hover:underline disabled:opacity-50"
                      data-testid="resend-otp-btn"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-[#E23744] hover:bg-[#c42f3c] h-12 text-base font-semibold shadow-md"
                disabled={loading || otpCode.length !== 6}
                data-testid="verify-otp-btn"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                Verify OTP
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={resetFlow}
                data-testid="change-phone-btn"
              >
                <ArrowLeft size={16} className="mr-2" />
                Change Phone Number
              </Button>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11"
                    placeholder="Enter your full name"
                    required
                    data-testid="name-input"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-[#E23744] hover:bg-[#c42f3c] h-12 text-base font-semibold shadow-md"
                disabled={loading || !name.trim()}
                data-testid="register-btn"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                Complete Registration
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsAdmin(true)}
              className="text-sm text-gray-500 hover:text-[#E23744] transition-colors font-medium"
              data-testid="admin-login-link"
            >
              Admin Login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
