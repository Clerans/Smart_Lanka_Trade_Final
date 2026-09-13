import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';
import { firebaseAuthService } from '../../services/firebaseAuthService';

export const OTPVerificationScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = route.params?.email || firebaseAuthService.getCurrentUser()?.email || '';

  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Toast & Network error states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);

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

  const handleCheckVerification = async () => {
    setLoading(true);
    setIsNetworkError(false);
    try {
      const user = await firebaseAuthService.reloadUser();

      if (user?.emailVerified) {
        showToast('Email verified successfully! Syncing your account...', 'success');
        try {
          await authService.sync();
        } catch (syncErr) {
          console.warn('Sync warning:', syncErr);
        }
        setTimeout(() => {
          navigation.replace('MainApp');
        }, 1000);
      } else {
        showToast('Email not yet verified. Please tap the verification link in your email and try again.', 'warning');
      }
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Could not verify status. Please try again.', 'error');
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
      await firebaseAuthService.sendEmailVerification();
      showToast('A new verification email has been sent!', 'success');
      setTimer(60);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Failed to resend verification email.', 'error');
      }
    } finally {
      setResending(false);
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
            handleCheckVerification();
          }}
        />
      )}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
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
            <MaterialIcons name="mark-email-read" size={48} color={colors.accent} />
          </View>

          <Text style={styles.mainTitle}>Check Your Inbox</Text>
          <Text style={styles.description}>
            We have sent a verification email to{' '}
            <Text style={styles.highlightText}>{email || 'your registered email'}</Text>.
            Please click the verification link in the email to activate your account.
          </Text>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color={colors.accent} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={styles.infoCardText}>
              Once you tap the link in your email, return to this screen and tap the button below.
            </Text>
          </View>

          {/* Primary Action Button */}
          {loading ? (
            <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
          ) : (
            <PrimaryButton
              title="I've Verified My Email →"
              onPress={handleCheckVerification}
              style={styles.verifyBtn}
            />
          )}

          {/* Resend Action */}
          <View style={styles.resendSection}>
            <Text style={styles.didNotReceive}>Didn't receive the email?</Text>
            <View style={styles.timerRow}>
              {timer > 0 ? (
                <View style={styles.timerPill}>
                  <MaterialIcons name="access-time" size={16} color={colors.accent} />
                  <Text style={styles.timerText}>
                    Resend in 00:{timer < 10 ? `0${timer}` : timer}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={resending}>
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.resendText}>Resend Verification Email</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity onPress={handleBackToLogin} style={styles.backToLoginBtn}>
            <Text style={styles.backToLoginText}>Log In with Another Account</Text>
          </TouchableOpacity>

          <Text style={styles.securityBadge}>
            SMARTLANKA TRADE SECURITY
          </Text>
        </View>

      </ScrollView>
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
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  mainTitle: {
    ...typography.h2,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  highlightText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusCard,
    padding: 16,
    marginBottom: 28,
    width: '100%',
    alignItems: 'flex-start',
  },
  infoCardText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
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
  backToLoginBtn: {
    paddingVertical: 12,
    marginBottom: 24,
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
