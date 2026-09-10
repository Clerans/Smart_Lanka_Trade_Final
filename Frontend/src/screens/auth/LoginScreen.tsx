import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  TextInput as RNTextInput
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, typography, layout } from '../../theme';
import { InputField, PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';
import { storageService } from '../../services/storageService';

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const passwordInputRef = useRef<RNTextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google sign-in state
  const [googleModalVisible, setGoogleModalVisible] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState('');

  // Toast & Network states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleGoogleLogin = async (idToken: string) => {
    setGoogleModalVisible(false);
    setLoading(true);
    setIsNetworkError(false);
    try {
      const response = await authService.googleLogin(idToken);
      if (response.token) {
        await AsyncStorage.setItem('rememberMe', 'true');
        showToast('Successfully signed in with Google!', 'success');
        setTimeout(() => {
          navigation.replace('MainApp');
        }, 1200);
      }
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Google Sign-In failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return;

    if (!email.trim() || !password) {
      showToast('Please enter both email and password', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    try {
      const response = await authService.login(email.trim(), password);
      if (response.token) {
        await AsyncStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
        navigation.replace('MainApp');
      }
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else if (error.code === 'EMAIL_NOT_VERIFIED') {
        showToast('Please verify your email before logging in. Redirecting...', 'warning');
        setTimeout(() => {
          navigation.navigate('OTPVerification', { email: email.trim() });
        }, 2000);
      } else {
        showToast(error.message || 'Login failed. Please check your credentials.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (loading) return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometrics Not Set Up',
          'Biometric hardware or enrolled fingerprint/Face ID was not detected on this device. Please log in with your email and password first, then enable it in Security Settings.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with Fingerprint or Face ID to Login',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        const storedToken = await storageService.getToken();
        const storedUser = await storageService.getUserData();

        if (storedToken && storedUser) {
          showToast('Biometric verified! Signing in...', 'success');
          setTimeout(() => {
            navigation.replace('MainApp');
          }, 600);
        } else if (email && password) {
          handleLogin();
        } else {
          showToast('Biometrics verified! Sign in once with password to link your account.', 'success');
        }
      } else {
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel') {
          showToast('Biometric authentication failed. Please use your password.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Biometric auth error:', err);
      showToast('Biometric authentication encountered an error.', 'error');
    }
  };

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
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.accent} size="large" />
                </View>
              ) : (
                <PrimaryButton
                  title="Login to Dashboard"
                  onPress={handleLogin}
                  disabled={loading}
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
                style={[styles.googleButton, loading && styles.buttonDisabled]}
                activeOpacity={0.8}
                disabled={loading}
                onPress={() => {
                  setGoogleIdToken('');
                  setGoogleModalVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <FontAwesome5 name="google" size={16} color="#FFFFFF" />
                <Text style={styles.googleText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
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

      {/* Google Chooser Modal */}
      <Modal
        visible={googleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGoogleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <FontAwesome5 name="google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
              <Text style={styles.modalTitle}>Sign in with Google</Text>
            </View>
            <Text style={styles.modalSubtitle}>Provide your verified Google ID Token to authenticate</Text>

            <View style={styles.customInputSection}>
              <TextInput
                placeholder="Paste Google ID Token"
                placeholderTextColor={colors.textSecondary}
                value={googleIdToken}
                onChangeText={setGoogleIdToken}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.customGoogleInput}
              />
              <View style={styles.customInputButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setGoogleModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={() => {
                    if (!googleIdToken.trim()) {
                      showToast('Please provide a valid Google ID token', 'warning');
                      return;
                    }
                    handleGoogleLogin(googleIdToken.trim());
                  }}
                >
                  <Text style={styles.submitBtnText}>Verify & Login</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setGoogleModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close Modal"
            >
              <Text style={styles.closeModalText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    width: '100%',
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  customInputSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  customGoogleInput: {
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusSmall,
    color: colors.textPrimary,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  customInputButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  submitBtnText: {
    color: '#000',
    fontWeight: '700',
  },
  closeModalButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  closeModalText: {
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
