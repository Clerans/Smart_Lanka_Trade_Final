import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';

export const OTPVerificationScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = route.params?.email || '';

  // 6-digit OTP State
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Toast & Network error states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 500);
  }, []);

  // Resend Countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // Mask email for display (e.g. cl****pc@gmail.com)
  const maskEmail = (str: string) => {
    if (!str || !str.includes('@')) return str || 'your registered email';
    const [user, domain] = str.split('@');
    if (user.length <= 2) {
      return `${user[0]}*@${domain}`;
    }
    const visibleStart = user.substring(0, 2);
    const visibleEnd = user.substring(user.length - 2);
    return `${visibleStart}****${visibleEnd}@${domain}`;
  };

  // Handle individual digit change with auto-advance and paste support
  const handleDigitChange = (value: string, index: number) => {
    // Handle paste of full 6-digit string
    const cleanDigits = value.replace(/[^0-9]/g, '');
    if (cleanDigits.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = cleanDigits[i] || '';
      }
      setOtp(newOtp);
      const nextFocus = Math.min(cleanDigits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const singleDigit = cleanDigits.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = singleDigit;
    setOtp(newOtp);

    // Auto-advance to next box if digit entered
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace key press
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const isOtpComplete = otp.every(digit => digit.length === 1);
  const otpString = otp.join('');

  const handleVerify = async () => {
    if (!isOtpComplete) {
      showToast('Please enter the full 6-digit verification code.', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    try {
      const result = await authService.verifyOtp(email, otpString);
      showToast(result.message || 'Email verified successfully!', 'success');
      setTimeout(() => {
        navigation.replace('MainApp');
      }, 1000);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Verification failed. Please check the code and try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setIsNetworkError(false);
    try {
      await authService.sendOtp(email);
      showToast('A new 6-digit verification code has been sent!', 'success');
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Failed to resend verification code.', 'error');
      }
    } finally {
      setResending(false);
    }
  };

  // Handle Fallback: Firebase Email Verification Link
  const handleSendEmailLink = async () => {
    setSendingLink(true);
    setIsNetworkError(false);
    try {
      await firebaseVerificationService.sendVerificationLink(email);
      setFallbackMode(true);
      showToast('Firebase verification link sent to your email!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Could not send verification email. Please try again.', 'error');
    } finally {
      setSendingLink(false);
    }
  };

  // Check if Firebase email link was clicked
  const handleCheckEmailLinkVerification = async () => {
    setCheckingLinkStatus(true);
    try {
      const isVerified = await firebaseVerificationService.checkEmailLinkVerified();
      if (isVerified) {
        // Synchronize with Oracle backend
        await authService.sync();
        showToast('Email verified successfully! Welcome to SmartLanka Trade.', 'success');
        setTimeout(() => {
          navigation.replace('MainApp');
        }, 800);
      } else {
        showToast('Email not verified yet. Please click the link in your email and tap this button again.', 'warning');
      }
    } catch (error: any) {
      showToast('Unable to confirm verification status. Please try again.', 'error');
    } finally {
      setCheckingLinkStatus(false);
    }
  };

  const handleBackToLogin = async () => {
    await authService.logout();
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isNetworkError && (
        <NetworkErrorScreen
          onRetry={() => {
            setIsNetworkError(false);
            if (fallbackMode) {
              handleCheckEmailLinkVerification();
            } else {
              handleVerify();
            }
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
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Email Verification</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialIcons name={fallbackMode ? "mail" : "mark-email-read"} size={44} color={colors.accent} />
            </View>

            <Text style={styles.mainTitle}>
              {fallbackMode ? 'Email Link Verification' : 'Verify Your Email'}
            </Text>
            <Text style={styles.description}>
              {fallbackMode
                ? 'We sent a verification link to your email address'
                : 'We\'ve sent a 6-digit verification code to'}
            </Text>
            <Text style={styles.highlightText}>{maskEmail(email)}</Text>

            {!fallbackMode ? (
              <>
                {/* 6-Digit OTP Input Boxes */}
                <View style={styles.otpRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={el => {
                        inputRefs.current[index] = el;
                      }}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : null,
                      ]}
                      value={digit}
                      onChangeText={val => handleDigitChange(val, index)}
                      onKeyPress={e => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={6} // Allows paste
                      selectTextOnFocus
                      textAlign="center"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      accessibilityLabel={`OTP Digit ${index + 1}`}
                    />
                  ))}
                </View>

                {/* Verify Button */}
                {loading ? (
                  <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
                ) : (
                  <PrimaryButton
                    title="Verify Code →"
                    onPress={handleVerify}
                    disabled={!isOtpComplete}
                    style={[styles.verifyBtn, !isOtpComplete && { opacity: 0.5 }]}
                  />
                )}

                {/* Resend Action */}
                <View style={styles.resendSection}>
                  <Text style={styles.didNotReceive}>Didn&apos;t receive the code?</Text>
                  <View style={styles.timerRow}>
                    {timer > 0 ? (
                      <View style={styles.timerPill}>
                        <MaterialIcons name="access-time" size={16} color={colors.accent} />
                        <Text style={styles.timerText}>
                          Resend code in 00:{timer < 10 ? `0${timer}` : timer}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={handleResend} disabled={resending}>
                        {resending ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Text style={styles.resendText}>Resend 6-Digit Code</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Fallback Option: Email Link */}
                  <View style={styles.fallbackDivider}>
                    <Text style={styles.fallbackOrText}>or</Text>
                  </View>

                  <TouchableOpacity
                    onPress={handleSendEmailLink}
                    disabled={sendingLink}
                    style={styles.fallbackButton}
                  >
                    {sendingLink ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={styles.fallbackButtonText}>Verify using email link</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Fallback instructions & check button */}
                <View style={styles.fallbackInstructionsCard}>
                  <Text style={styles.instructionStep}>1. Check your email inbox for the verification email.</Text>
                  <Text style={styles.instructionStep}>2. Tap the confirmation link in the email.</Text>
                  <Text style={styles.instructionStep}>3. Return here and tap the button below.</Text>
                </View>

                {checkingLinkStatus ? (
                  <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
                ) : (
                  <PrimaryButton
                    title="I Have Verified My Email"
                    onPress={handleCheckEmailLinkVerification}
                    style={styles.verifyBtn}
                  />
                )}

                <TouchableOpacity
                  onPress={() => setFallbackMode(false)}
                  style={styles.backToOtpBtn}
                >
                  <Text style={styles.backToOtpText}>← Back to 6-Digit Code</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={handleBackToLogin} style={styles.backToLoginBtn}>
              <Text style={styles.backToLoginText}>Log In with Another Account</Text>
            </TouchableOpacity>

            <Text style={styles.securityBadge}>
              SMARTLANKA TRADE SECURITY
            </Text>
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
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    flex: 1,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  mainTitle: {
    ...typography.h2,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 22,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 22,
  },
  highlightText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 28,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
    paddingHorizontal: 2,
  },
  otpBox: {
    flex: 1,
    maxWidth: 48,
    minWidth: 38,
    height: 52,
    marginHorizontal: 3,
    borderRadius: 12,
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  otpBoxFilled: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  verifyBtn: {
    width: '100%',
    marginBottom: 24,
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  didNotReceive: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerText: {
    ...typography.bodySmall,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '600',
  },
  resendText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
  },
  fallbackDivider: {
    marginVertical: 12,
  },
  fallbackOrText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 12,
  },
  fallbackButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  fallbackButtonText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  fallbackInstructionsCard: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    marginBottom: 24,
  },
  instructionStep: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
  },
  backToOtpBtn: {
    paddingVertical: 12,
    marginBottom: 12,
  },
  backToOtpText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  backToLoginBtn: {
    paddingVertical: 12,
    marginBottom: 20,
  },
  backToLoginText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '600',
  },
  securityBadge: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: 8,
  },
});
