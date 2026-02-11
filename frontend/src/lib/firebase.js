import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Store verifier reference
let recaptchaWidgetId = null;

// Completely destroy and clean up reCAPTCHA
export const clearRecaptcha = () => {
  // Clear window references
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.log('Clear verifier error (safe to ignore):', e.message);
    }
    window.recaptchaVerifier = null;
  }
  
  recaptchaWidgetId = null;
  
  // Clear container HTML
  const container = document.getElementById('recaptcha-container');
  if (container) {
    container.innerHTML = '';
  }
  
  // Remove any orphaned iframes
  const iframes = document.querySelectorAll('iframe[src*="recaptcha"]');
  iframes.forEach(iframe => {
    try {
      iframe.parentNode?.removeChild(iframe);
    } catch (e) {}
  });
};

// Setup visible reCAPTCHA - returns a promise
export const setupRecaptcha = (onVerified, onError) => {
  return new Promise((resolve, reject) => {
    // Clear any existing first
    clearRecaptcha();
    
    const container = document.getElementById('recaptcha-container');
    if (!container) {
      console.error('reCAPTCHA container not found');
      reject(new Error('Container not found'));
      return;
    }
    
    // Ensure container is empty
    container.innerHTML = '';
    
    try {
      // Create new verifier with visible checkbox
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: (response) => {
          console.log('✅ reCAPTCHA verified successfully');
          if (onVerified) onVerified(response);
        },
        'expired-callback': () => {
          console.log('⚠️ reCAPTCHA expired - user needs to re-verify');
          if (onError) onError('expired');
        },
        'error-callback': (error) => {
          console.error('❌ reCAPTCHA error:', error);
          if (onError) onError(error);
        }
      });
      
      // Store globally for signInWithPhoneNumber
      window.recaptchaVerifier = verifier;
      
      // Render the widget
      verifier.render()
        .then((widgetId) => {
          console.log('✅ reCAPTCHA rendered, widget ID:', widgetId);
          recaptchaWidgetId = widgetId;
          resolve(verifier);
        })
        .catch((error) => {
          console.error('❌ reCAPTCHA render failed:', error);
          reject(error);
        });
        
    } catch (error) {
      console.error('❌ Error creating reCAPTCHA:', error);
      reject(error);
    }
  });
};

// Send OTP to phone number
export const sendOTP = async (phoneNumber) => {
  console.log('📱 Attempting to send OTP to:', phoneNumber);
  
  try {
    const verifier = window.recaptchaVerifier;
    
    if (!verifier) {
      return { 
        success: false, 
        message: 'reCAPTCHA not initialized. Please refresh the page and try again.',
        code: 'no-verifier'
      };
    }
    
    console.log('📤 Calling signInWithPhoneNumber...');
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    
    console.log('✅ OTP sent successfully!');
    window.confirmationResult = confirmationResult;
    
    return { success: true, message: 'OTP sent successfully!' };
    
  } catch (error) {
    console.error('❌ Send OTP Error:', {
      code: error.code,
      message: error.message,
      fullError: error
    });
    
    // Get user-friendly message based on error code
    let message = getErrorMessage(error);
    
    return { 
      success: false, 
      message,
      code: error.code,
      originalError: error.message
    };
  }
};

// Get user-friendly error message
const getErrorMessage = (error) => {
  const errorCode = error.code || '';
  const errorMessage = error.message || '';
  
  // Map Firebase error codes to user-friendly messages
  const errorMessages = {
    'auth/too-many-requests': 'Too many attempts. Please wait 5-10 minutes before trying again.',
    'auth/invalid-phone-number': 'Invalid phone number. Please enter a valid number with country code.',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please refresh the page and try again.',
    'auth/quota-exceeded': 'SMS quota exceeded. Please try again later or contact support.',
    'auth/user-disabled': 'This phone number has been disabled. Please contact support.',
    'auth/operation-not-allowed': 'Phone authentication is not enabled. Please contact support.',
    'auth/invalid-app-credential': 'App verification failed. Please refresh the page and try again.',
    'auth/app-not-authorized': 'This app is not authorized for Firebase Authentication.',
    'auth/web-storage-unsupported': 'Your browser does not support web storage. Please try a different browser.',
    'auth/network-request-failed': 'Request failed. This often happens due to rate limiting. Please wait 2-3 minutes and try again, or try a different phone number.',
    'auth/unauthorized-domain': 'This domain is not authorized for Firebase Authentication.',
    'auth/missing-phone-number': 'Please enter a phone number.',
    'auth/invalid-verification-code': 'Invalid OTP code. Please check and try again.',
    'auth/code-expired': 'OTP has expired. Please request a new one.',
  };
  
  // Check if we have a specific message for this error code
  if (errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }
  
  // Check for network-related errors in the message
  if (errorMessage.toLowerCase().includes('network') || 
      errorMessage.toLowerCase().includes('fetch') ||
      errorMessage.toLowerCase().includes('connection')) {
    return 'Network error. This may be due to rate limiting. Please wait a few minutes and try again.';
  }
  
  // Return the original error message with the code for debugging
  return `Error (${errorCode || 'unknown'}): ${errorMessage || 'An unexpected error occurred. Please try again.'}`;
};

// Verify OTP
export const verifyOTP = async (otp) => {
  console.log('🔐 Verifying OTP...');
  
  try {
    if (!window.confirmationResult) {
      return {
        success: false,
        message: 'No OTP request found. Please request a new OTP.',
        code: 'no-confirmation'
      };
    }
    
    const result = await window.confirmationResult.confirm(otp);
    console.log('✅ OTP verified successfully!');
    
    const idToken = await result.user.getIdToken();
    
    return { 
      success: true, 
      user: result.user, 
      idToken,
      phoneNumber: result.user.phoneNumber 
    };
    
  } catch (error) {
    console.error('❌ Verify OTP Error:', {
      code: error.code,
      message: error.message
    });
    
    let message = getErrorMessage(error);
    
    return { 
      success: false, 
      message, 
      code: error.code 
    };
  }
};

// Get current user's ID token
export const getIdToken = async () => {
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
};

// Check if user is already authenticated with Firebase
export const checkExistingAuth = () => {
  const user = auth.currentUser;
  if (user) {
    return {
      isAuthenticated: true,
      phoneNumber: user.phoneNumber,
      uid: user.uid
    };
  }
  return { isAuthenticated: false };
};

// Get current Firebase user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Sign out from Firebase
export const firebaseSignOut = async () => {
  try {
    await auth.signOut();
    window.confirmationResult = null;
    clearRecaptcha();
    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('❌ Sign out error:', error);
  }
};

export { auth, app };
