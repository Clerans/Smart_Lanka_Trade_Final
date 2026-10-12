import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput as RNTextInput
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { colors, typography, layout } from '../../theme';
import { InputField, PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';
import { storageService } from '../../services/storageService';

// Configure Native Google Sign-In with Web Client ID for server authorization
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '614054153944-tsftd7h3hmj1d43ave18m0cnrfmpf8v1.apps.googleusercontent.com';

// Expo Go sandbox does not include custom native modules like RNGoogleSignin.
// We dynamically require GoogleSignin only in standalone / bare / dev builds to prevent runtime crashes in Expo Go.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let GoogleSignin: any = null;
let statusCodes: any = null;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    const googleModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleModule.GoogleSignin;
    statusCodes = googleModule.statusCodes;
    if (GoogleSignin) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        offlineAccess: false,
      });
    }
  } catch (err) {
    console.warn('Native GoogleSignin is not available in this environment:', err);
  }
}

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const passwordInputRef = useRef<RNTextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Toast & Network states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);



  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedRemember = await AsyncStorage.getItem('rememberMe');
        if (savedRemember === 'true') {
          setRememberMe(true);
          const savedEmail = await AsyncStorage.getItem('savedEmail');
          if (savedEmail) {
            setEmail(savedEmail);
          }
        }
      } catch (err) {
        console.error('Error loading saved credentials:', err);
      }
    };
    loadSavedCredentials();
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const checkAndOfferBiometrics = async (onComplete: () => void) => {
    try {
      const existingBioPref = await AsyncStorage.getItem('@pref_biometric');
      if (existingBioPref === null) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
        const isEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);

        if (hasHardware && isEnrolled) {
          const types: LocalAuthentication.AuthenticationType[] = await LocalAuthentication.supportedAuthenticationTypesAsync();
          const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
            ? 'Fingerprint or Facial Recognition'
            : 'Fingerprint';

          Alert.alert(
            'Enable Biometric Login',
            `Would you like to enable ${label} for faster and secure future sign-ins?`,
            [
              {
                text: 'Not Now',
                style: 'cancel',
                onPress: async () => {
                  await AsyncStorage.setItem('@pref_biometric', 'false');
                  onComplete();
                }
              },
              {
                text: 'Enable',
                onPress: async () => {
                  try {
                    const bioAuth = await LocalAuthentication.authenticateAsync({
                      promptMessage: `Authenticate with ${label} to enable quick sign-in`,
                      fallbackLabel: 'Cancel',
                      disableDeviceFallback: true,
                    });
                    if (bioAuth.success) {
                      await AsyncStorage.setItem('@pref_biometric', 'true');
                      showToast('Biometric login enabled!', 'success');
                    } else {
                      await AsyncStorage.setItem('@pref_biometric', 'false');
                    }
                  } catch {
                    await AsyncStorage.setItem('@pref_biometric', 'false');
                  }
                  onComplete();
                }
              }
            ]
          );
          return;
        }
      }
    } catch {
      // Fallback
    }
    onComplete();
  };

  const handleGoogleLogin = useCallback(async (authParams: any) => {
    setLoading(true);
    setGoogleLoading(true);
    setIsNetworkError(false);
    try {
      const authResult = await authService.googleLogin(authParams);
      if (authResult && authResult.token) {
        await AsyncStorage.setItem('rememberMe', 'true');
        // Persist session specifically for biometric restoration
        await storageService.saveBiometricSession(authResult.token, authResult.user);
        showToast('Successfully signed in with Google!', 'success');
        setTimeout(() => {
          checkAndOfferBiometrics(() => {
            navigation.replace('MainApp');
          });
        }, 600);
      }
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else if (error.code === 'INVALID_GOOGLE_TOKEN' || error.code === 'UNVERIFIED_EMAIL') {
        showToast('Google authentication could not be verified. Please try again.', 'error');
      } else {
        showToast(error.message || 'Google sign-in failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
      setGoogleLoading(false);
    }
  }, [navigation, showToast]);

  // Native Google Sign-In Handler
  const handleGooglePress = async () => {
    if (loading || googleLoading) return;

    if (isExpoGo) {
      Alert.alert(
        'Expo Go Notice',
        'Native Google Sign-In uses custom native Android libraries (@react-native-google-signin/google-signin) which are not supported inside the Expo Go sandbox.\n\nPlease sign in with your email & password while in Expo Go, or test Google Sign-In in your standalone APK built with EAS.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Google Play Services is a native Android framework and does not exist in desktop web browsers
    if (Platform.OS === 'web') {
      showToast('Native Google Sign-In requires an Android device with Google Play Services. For web preview, please log in with your email and password.', 'warning');
      return;
    }

    if (!GoogleSignin) {
      showToast('Native Google Sign-In module is not available in this build.', 'error');
      return;
    }

    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      let idToken: string | null | undefined = null;
      if (response && response.type === 'success') {
        idToken = response.data?.idToken;
      } else if ((response as any)?.data?.idToken) {
        idToken = (response as any).data.idToken;
      } else if ((response as any)?.idToken) {
        idToken = (response as any).idToken;
      }

      if (idToken) {
        await handleGoogleLogin({ idToken });
      } else if (response && (response as any).type === 'cancelled') {
        setGoogleLoading(false);
      } else {
        showToast('Could not retrieve Google ID token. Please try again.', 'error');
        setGoogleLoading(false);
      }
    } catch (err: any) {
      if (statusCodes && err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the sign-in modal
        setGoogleLoading(false);
      } else if (statusCodes && err.code === statusCodes.IN_PROGRESS) {
        // Operation already in progress
        setGoogleLoading(true);
      } else if (statusCodes && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        showToast('Google Play Services is not available or needs updating on this device.', 'error');
        setGoogleLoading(false);
      } else {
        console.warn('Native Google Sign-In Error:', err);
        showToast(err.message || 'Google sign-in failed. Please try again.', 'error');
        setGoogleLoading(false);
      }
    }
  };

  const handleLogin = async () => {
    if (loading || googleLoading) return;

    if (!email.trim() || !password) {
      showToast('Please enter both email and password', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    try {
      const authResult = await authService.login(email.trim(), password);
      if (authResult && authResult.token) {
        if (rememberMe) {
          await AsyncStorage.setItem('rememberMe', 'true');
          await AsyncStorage.setItem('savedEmail', email.trim());
        } else {
          await AsyncStorage.removeItem('rememberMe');
          await AsyncStorage.removeItem('savedEmail');
        }
        // Save session credentials for future biometric login
        await storageService.saveBiometricSession(authResult.token, authResult.user);
        await checkAndOfferBiometrics(() => {
          navigation.replace('MainApp');
        });
      }
    } catch (error: any) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        showToast('Email not verified. Sending verification code...', 'warning');
        try {
          await authService.sendVerification(email.trim());
        } catch (e) {}
        setTimeout(() => {
          navigation.navigate('OTPVerification', { email: email.trim() });
        }, 1200);
      } else if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Login failed. Please check your credentials.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (loading || googleLoading) return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        Alert.alert(
          'Biometrics Unavailable',
          'Biometric hardware sensor was not detected on this device. Please sign in with your password or Google.'
        );
        return;
      }

      if (!isEnrolled) {
        Alert.alert(
          'No Biometrics Enrolled',
          'Please enroll fingerprint or facial recognition in your Android device settings first.'
        );
        return;
      }

      // Check if a usable session exists before prompting for local authentication
      const hasSession = await storageService.hasBiometricSession();
      if (!hasSession) {
        Alert.alert(
          'Sign In Required',
          'No saved session found for biometric login on this device. Please sign in once with your password or Google to enable biometric access.',
          [{ text: 'OK' }]
        );
        return;
      }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const promptLabel = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? 'Authenticate with Face or Fingerprint'
        : 'Authenticate with Fingerprint';

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `${promptLabel} to sign in`,
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setLoading(true);
        const session = await storageService.getBiometricSession();
        if (session && session.token) {
          // Restore credentials into active session storage
          await storageService.setToken(session.token);
          if (session.user) {
            await storageService.setUserData(session.user);
          }

          // Authoritatively validate the restored session with the backend
          try {
            const validation = await authService.validateToken();
            if (validation && validation.success) {
              showToast('Biometrics verified! Welcome back.', 'success');
              setTimeout(() => {
                navigation.replace('MainApp');
              }, 500);
              return;
            }
          } catch (valErr: any) {
            console.warn('Biometric session expired or revoked:', valErr);
            // Session revoked or expired beyond validity: clear obsolete biometric session
            await storageService.clearBiometricSession();
            showToast('Your session has expired. Please sign in with password or Google.', 'warning');
          }
        } else {
          showToast('Could not retrieve saved credentials. Please sign in with password.', 'warning');
        }
      } else {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          showToast('Biometric authentication failed. Please use your password.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Biometric auth error:', err);
      showToast('Biometric authentication encountered an error.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const hasPromptedAutoBiometrics = useRef(false);

  useEffect(() => {
    let autoBioTimer: NodeJS.Timeout | null = null;
    const triggerAutoBiometrics = async () => {
      if (hasPromptedAutoBiometrics.current) return;
      try {
        const bioPref = await AsyncStorage.getItem('@pref_biometric');
        if (bioPref === 'true') {
          const hasSession = await storageService.hasBiometricSession();
          if (hasSession) {
            hasPromptedAutoBiometrics.current = true;
            autoBioTimer = setTimeout(() => {
              handleBiometricLogin();
            }, 350);
          }
        }
      } catch (err) {
        console.warn('Auto biometric prompt error:', err);
      }
    };

    triggerAutoBiometrics();

    return () => {
      if (autoBioTimer) {
        clearTimeout(autoBioTimer);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {isNetworkError && (
        <NetworkErrorScreen
          onRetry={() => {
            setIsNetworkError(false);
            handleLogin();
          }}
        />
      )}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingTop: Math.max(insets.top > 0 ? insets.top * 0.3 : 10, 10),
              paddingBottom: Math.max(insets.bottom > 0 ? insets.bottom + 6 : 16, 16),
            }
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.innerWrapper}>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <MaterialIcons name="trending-up" size={24} color={colors.accent} />
              </View>
              <Text style={styles.appName}>SmartLanka Trade</Text>
              <Text style={styles.headline}>Welcome Back</Text>
              <Text style={styles.subtitle}>Trade Smarter. Securely.</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {/* Email Address */}
              <Text style={styles.label}>Email Address</Text>
              <InputField
                placeholder="yourname@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email Address"
                iconLeft={<MaterialIcons name="mail-outline" size={18} color={colors.accent} />}
              />

              {/* Password Header */}
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password"
                >
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Password Input */}
              <InputField
                ref={passwordInputRef}
                placeholder="••••••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                value={password}
                onChangeText={setPassword}
                accessibilityLabel="Password"
                iconLeft={<MaterialIcons name="lock-outline" size={18} color={colors.accent} />}
                iconRight={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                }
              />

              {/* Remember Me Checkbox (Own Row) */}
              <TouchableOpacity
                style={styles.rememberMeContainer}
                activeOpacity={0.8}
                onPress={() => setRememberMe(!rememberMe)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                accessibilityLabel="Remember Me"
              >
                <MaterialIcons
                  name={rememberMe ? "check-box" : "check-box-outline-blank"}
                  size={18}
                  color={rememberMe ? colors.accent : colors.textSecondary}
                />
                <Text style={styles.rememberMeText}>Remember Me</Text>
              </TouchableOpacity>

              {/* Use Biometrics Button (Centered Pill) */}
              <TouchableOpacity 
                style={styles.biometricsButton} 
                activeOpacity={0.7} 
                onPress={handleBiometricLogin}
                accessibilityRole="button"
                accessibilityLabel="Use Biometrics to login"
              >
                <MaterialIcons name="fingerprint" size={18} color={colors.accent} />
                <Text style={styles.biometricsText}>Use Biometrics</Text>
              </TouchableOpacity>

              {/* Login Button */}
              {loading && !googleLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.accent} size="large" />
                </View>
              ) : (
                <PrimaryButton
                  title="Login to Dashboard"
                  onPress={handleLogin}
                  disabled={loading || googleLoading}
                  style={styles.loginBtn}
                  accessibilityLabel="Login to Dashboard"
                />
              )}

              {/* OR Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                style={[styles.googleButton, (loading || googleLoading) && styles.buttonDisabled]}
                activeOpacity={0.8}
                disabled={loading || googleLoading}
                onPress={handleGooglePress}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome5 name="google" size={16} color="#FFFFFF" />
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don&apos;t have an account?{' '}
                <Text
                  style={styles.registerLink}
                  onPress={() => navigation.navigate('Register')}
                  accessibilityRole="button"
                  accessibilityLabel="Register Now"
                >
                  Register Now
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  innerWrapper: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 420,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 6,
  },
  headline: {
    ...typography.h1,
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    width: '100%',
    marginTop: 8,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 6,
  },
  forgotPassword: {
    ...typography.bodySmall,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  rememberMeText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '500',
  },
  biometricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    backgroundColor: colors.bgInput,
    alignSelf: 'center',
    marginBottom: 16,
  },
  biometricsText: {
    ...typography.bodySmall,
    color: colors.accent,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtn: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    height: 52,
    borderRadius: layout.borderRadiusPill,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: 14,
    fontSize: 11,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleText: {
    ...typography.body,
    color: '#FFFFFF',
    marginLeft: 10,
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  registerLink: {
    color: colors.accent,
    fontWeight: '700',
  },
});
