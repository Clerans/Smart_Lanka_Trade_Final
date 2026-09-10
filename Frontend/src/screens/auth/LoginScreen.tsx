import * as React from 'react';
const { useState } = React;
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, typography, layout } from '../../theme';
import { InputField, PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';

const { height } = Dimensions.get('window');
const isSmallDevice = height < 700;

export const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google sign-in simulation states
  const [googleModalVisible, setGoogleModalVisible] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);

  // Toast states
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
        await AsyncStorage.setItem('rememberMe', 'true'); // Auto-login on startup for Google OAuth
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
    if (!email || !password) {
      showToast('Please enter both email and password', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    try {
      const response = await authService.login(email, password);
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
          navigation.navigate('OTPVerification', { email });
        }, 2000);
      } else {
        showToast(error.message || 'Login failed. Please check your credentials.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
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
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');

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
    <SafeAreaView style={styles.safeArea}>
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
        <View style={styles.container}>

          <View style={styles.spacer} />

          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialIcons name="trending-up" size={isSmallDevice ? 20 : 24} color={colors.accent} />
            </View>
            <Text style={styles.appName}>SmartLanka Trade</Text>

            <Text style={styles.headline}>Welcome Back</Text>
            <Text style={styles.subtitle}>Trade Smarter. Securely.</Text>
          </View>

          <View style={styles.spacer} />

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Email Address</Text>
            <InputField
              placeholder="yourname@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              iconLeft={<MaterialIcons name="mail-outline" size={20} color={colors.accent} />}
            />

            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <InputField
              placeholder="••••••••••••"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              iconLeft={<MaterialIcons name="lock-outline" size={20} color={colors.accent} />}
              iconRight={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              }
            />

            {/* Remember Me Checkbox */}
            <TouchableOpacity
              style={styles.rememberMeContainer}
              activeOpacity={0.8}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <MaterialIcons
                name={rememberMe ? "check-box" : "check-box-outline-blank"}
                size={20}
                color={rememberMe ? colors.accent : colors.textSecondary}
              />
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>

            {/* Biometrics Button */}
            <TouchableOpacity 
              style={styles.biometricsButton} 
              activeOpacity={0.7} 
              onPress={handleBiometricLogin}
            >
              <MaterialIcons name="fingerprint" size={20} color={colors.accent} />
              <Text style={styles.biometricsText}>Use Biometrics</Text>
            </TouchableOpacity>

            {/* Primary CTA */}
            {loading ? (
              <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
            ) : (
              <PrimaryButton
                title="Login to Dashboard"
                onPress={handleLogin}
                style={styles.loginBtn}
              />
            )}
          </View>

          <View style={styles.smallSpacer} />

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.smallSpacer} />

          {/* Google Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => {
              setShowCustomGoogleInput(false);
              setCustomGoogleEmail('');
              setCustomGoogleName('');
              setGoogleModalVisible(true);
            }}
          >
            <FontAwesome5 name="google" size={18} color="#FFFFFF" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

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
                  <Text style={styles.modalTitle}>Sign in with Google (Demo)</Text>
                </View>
                <Text style={styles.modalSubtitle}>Choose a demo account or enter your email to continue</Text>

                {/* Demo Account List */}
                <TouchableOpacity
                  style={styles.googleAccountItem}
                  onPress={() => handleGoogleLogin('demo.trader@smartlanka.com', 'Demo Trader')}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>DT</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>Demo Trader</Text>
                    <Text style={styles.accountEmail}>demo.trader@smartlanka.com</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.googleAccountItem}
                  onPress={() => handleGoogleLogin('investor.demo@smartlanka.com', 'Institutional Demo')}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>ID</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>Institutional Demo</Text>
                    <Text style={styles.accountEmail}>investor.demo@smartlanka.com</Text>
                  </View>
                </TouchableOpacity>

                {!showCustomGoogleInput ? (
                  <TouchableOpacity
                    style={styles.addAccountButton}
                    onPress={() => setShowCustomGoogleInput(true)}
                  >
                    <MaterialIcons name="person-add-alt-1" size={20} color={colors.accent} style={{ marginRight: 12 }} />
                    <Text style={styles.addAccountText}>Use another account</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.customInputSection}>
                    <TextInput
                      placeholder="Enter Name"
                      placeholderTextColor={colors.textSecondary}
                      value={customGoogleName}
                      onChangeText={setCustomGoogleName}
                      style={styles.customGoogleInput}
                    />
                    <TextInput
                      placeholder="Enter Google Email"
                      placeholderTextColor={colors.textSecondary}
                      value={customGoogleEmail}
                      onChangeText={setCustomGoogleEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.customGoogleInput}
                    />
                    <View style={styles.customInputButtons}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => setShowCustomGoogleInput(false)}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.submitBtn}
                        onPress={() => {
                          if (!customGoogleEmail || !customGoogleName) {
                            showToast('Please enter both name and email', 'warning');
                            return;
                          }
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!emailRegex.test(customGoogleEmail)) {
                            showToast('Please enter a valid email address', 'warning');
                            return;
                          }
                          handleGoogleLogin(customGoogleEmail, customGoogleName);
                        }}
                      >
                        <Text style={styles.submitBtnText}>Continue</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.closeModalButton} onPress={() => setGoogleModalVisible(false)}>
                  <Text style={styles.closeModalText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={styles.spacer} />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text
                style={styles.registerLink}
                onPress={() => navigation.navigate('Register')}
              >
                Register Now
              </Text>
            </Text>
          </View>

          <View style={styles.spacer} />

        </View>
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
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  smallSpacer: {
    flex: 0.5,
    minHeight: isSmallDevice ? 16 : 24,
  },
  header: {
    alignItems: 'center',
  },
  logoContainer: {
    width: isSmallDevice ? 36 : 48,
    height: isSmallDevice ? 36 : 48,
    borderRadius: isSmallDevice ? 18 : 24,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallDevice ? 8 : 16,
  },
  appName: {
    ...typography.h3,
    marginBottom: isSmallDevice ? 16 : 32,
  },
  headline: {
    ...typography.h1,
    fontSize: isSmallDevice ? 28 : 32,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: isSmallDevice ? 14 : 16,
    color: colors.accent,
  },
  formSection: {
    width: '100%',
  },
  label: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: isSmallDevice ? 8 : 12,
  },
  forgotPassword: {
    ...typography.bodySmall,
    color: colors.accent,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  rememberMeText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginLeft: 8,
    fontWeight: '500',
  },
  biometricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    alignSelf: 'center',
    marginBottom: isSmallDevice ? 16 : 24,
    marginTop: isSmallDevice ? 8 : 12,
  },
  biometricsText: {
    ...typography.bodySmall,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '600',
  },
  loginBtn: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: isSmallDevice ? 48 : 56,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleText: {
    ...typography.body,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    fontSize: isSmallDevice ? 14 : 16,
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
  googleAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  accountName: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  accountEmail: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  addAccountText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
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
