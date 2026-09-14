import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { InputField, PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';

export const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Toast & Network error states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      showToast('Please enter your email address', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showToast('Please enter a valid email address', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
      showToast('Password reset link sent to your email!', 'success');
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Failed to send reset link.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isNetworkError && (
        <NetworkErrorScreen
          onRetry={() => {
            setIsNetworkError(false);
            handleSendResetEmail();
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Reset Password</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.spacer} />

          {/* Icon section */}
          <View style={styles.iconSection}>
            <View style={styles.iconContainer}>
              <MaterialIcons name={sent ? "mark-email-read" : "lock-reset"} size={48} color={colors.accent} />
            </View>
            <Text style={styles.title}>{sent ? "Check Your Inbox" : "Reset Password"}</Text>
            <Text style={styles.subtitle}>
              {sent
                ? `We've sent a password reset link to ${email.trim()}. Follow the instructions in the email to set a new password.`
                : "Enter your registered email address below. We'll send you a password reset link to securely restore access to your account."
              }
            </Text>
          </View>

          <View style={styles.spacer} />

          {/* Form */}
          {!sent ? (
            <View style={styles.formSection}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <InputField
                placeholder="yourname@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                iconLeft={<MaterialIcons name="mail-outline" size={20} color={colors.textSecondary} />}
              />

              <View style={styles.smallSpacer} />

              {loading ? (
                <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
              ) : (
                <PrimaryButton
                  title="Send Password Reset Link →"
                  onPress={handleSendResetEmail}
                  style={styles.actionBtn}
                />
              )}
            </View>
          ) : (
            <View style={styles.formSection}>
              <PrimaryButton
                title="Back to Log In"
                onPress={() => navigation.navigate('Login')}
                style={styles.actionBtn}
              />
              <TouchableOpacity onPress={() => setSent(false)} style={styles.resendBtn}>
                <Text style={styles.resendBtnText}>Try another email address</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.spacer} />
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
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  spacer: {
    flex: 1,
  },
  smallSpacer: {
    height: 20,
  },
  iconSection: {
    alignItems: 'center',
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
  title: {
    ...typography.h2,
    marginBottom: 12,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 12,
  },
  formSection: {
    width: '100%',
  },
  label: {
    ...typography.label,
    marginBottom: 8,
  },
  actionBtn: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  resendBtnText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '600',
  }
});
