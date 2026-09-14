import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography } from '../../theme';
import { InputField, PrimaryButton, Toast, NetworkErrorScreen } from '../../components';
import { authService } from '../../services/apiService';

export const ResetPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = route.params?.email || '';

  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Toast & Network error states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [lastAction, setLastAction] = useState<'verify_otp' | 'reset_password'>('verify_otp');

  // Password requirements checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const getStrengthLevel = () => {
    let score = 0;
    if (password.length === 0) return 0;
    if (hasMinLength) score++;
    if (hasUppercase && hasLowercase) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    return score;
  };

  const strength = getStrengthLevel();

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleKeyPress = (num: string) => {
    if (step === 1 && otp.length < 6) {
      setOtp(prev => prev + num);
    }
  };

  const handleDelete = () => {
    if (step === 1) {
      setOtp(prev => prev.slice(0, -1));
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      showToast('Please enter the 6-digit OTP code', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    setLastAction('verify_otp');
    try {
      await authService.verifyResetOTP(email, otp);
      showToast('Code verified successfully!', 'success');
      setTimeout(() => {
        setStep(2);
      }, 1000);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Verification failed. Please check the code.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      showToast('Please fill in all password fields', 'warning');
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      showToast('Password must meet complexity requirements.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'warning');
      return;
    }

    setLoading(true);
    setIsNetworkError(false);
    setLastAction('reset_password');
    try {
      const response = await authService.resetPassword(email, otp, password);
      showToast(response.message || 'Password reset successful!', 'success');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Password reset failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAction = () => {
    setIsNetworkError(false);
    if (lastAction === 'verify_otp') {
      handleVerifyOTP();
    } else {
      handleResetPassword();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isNetworkError && <NetworkErrorScreen onRetry={handleRetryAction} />}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={{ width: 24 }} />
        </View>

        {step === 1 ? (
          /* Step 1: OTP Input screen */
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="vpn-key" size={48} color={colors.accent} />
            </View>

            <Text style={styles.mainTitle}>Enter Reset Code</Text>
            <Text style={styles.description}>
              We have sent a 6-digit verification code to <Text style={styles.highlightText}>{email}</Text>. Please enter it below.
            </Text>

            {/* OTP Input UI */}
            <View style={styles.otpContainer}>
              {[...Array(6)].map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    otp.length === index && styles.otpBoxActive,
                    otp.length > index && styles.otpBoxFilled
                  ]}
                >
                  <Text style={styles.otpText}>
                    {otp[index] || ''}
                  </Text>
                </View>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={colors.accent} size="large" style={{ marginBottom: 32 }} />
            ) : (
              <PrimaryButton
                title="Verify Reset Code →"
                onPress={handleVerifyOTP}
                style={styles.actionBtn}
              />
            )}

            {/* Custom Keypad */}
            <View style={styles.keypadContainer}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, i) => (
                <View key={i} style={styles.keypadRow}>
                  {row.map(num => (
                    <TouchableOpacity key={num} style={styles.keypadButton} onPress={() => handleKeyPress(num)}>
                      <Text style={styles.keypadText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                <View style={styles.keypadButton} />
                <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeyPress('0')}>
                  <Text style={styles.keypadText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadButton} onPress={handleDelete}>
                  <FontAwesome5 name="backspace" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* Step 2: New Password input screen */
          <KeyboardAvoidingView
            style={styles.keyboardAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="security" size={48} color={colors.accent} />
              </View>

              <Text style={styles.mainTitle}>Create New Password</Text>
              <Text style={styles.description}>
                Set a strong, unique password for secure access to your SmartLanka Trade dashboard.
              </Text>

              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>NEW PASSWORD</Text>
                <InputField
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  iconLeft={<MaterialIcons name="lock-outline" size={20} color={colors.textSecondary} />}
                  iconRight={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  }
                />

                {/* Password Strength UI */}
                <View style={styles.strengthContainer}>
                  <View style={[styles.strengthBar, strength >= 1 && styles.strengthActive]} />
                  <View style={[styles.strengthBar, strength >= 2 && styles.strengthActive]} />
                  <View style={[styles.strengthBar, strength >= 3 && styles.strengthActive]} />
                  <View style={[styles.strengthBar, strength >= 4 && styles.strengthActive]} />
                </View>
                <View style={styles.strengthTextRow}>
                  <Text style={[styles.strengthLabel, strength >= 4 && { color: colors.accent }]}>
                    STRENGTH: {strength >= 4 ? 'STRONG' : strength >= 2 ? 'MEDIUM' : strength > 0 ? 'WEAK' : 'NONE'}
                  </Text>
                </View>

                {/* Password Checklist */}
                <View style={styles.checklistContainer}>
                  <View style={styles.checklistItem}>
                    <MaterialIcons
                      name={hasMinLength ? "check-circle" : "radio-button-unchecked"}
                      size={14}
                      color={hasMinLength ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.checklistText, hasMinLength && styles.checklistTextActive]}>Min. 8 characters</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons
                      name={hasUppercase ? "check-circle" : "radio-button-unchecked"}
                      size={14}
                      color={hasUppercase ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.checklistText, hasUppercase && styles.checklistTextActive]}>At least one uppercase letter</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons
                      name={hasLowercase ? "check-circle" : "radio-button-unchecked"}
                      size={14}
                      color={hasLowercase ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.checklistText, hasLowercase && styles.checklistTextActive]}>At least one lowercase letter</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons
                      name={hasNumber ? "check-circle" : "radio-button-unchecked"}
                      size={14}
                      color={hasNumber ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.checklistText, hasNumber && styles.checklistTextActive]}>At least one number</Text>
                  </View>
                  <View style={styles.checklistItem}>
                    <MaterialIcons
                      name={hasSpecial ? "check-circle" : "radio-button-unchecked"}
                      size={14}
                      color={hasSpecial ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.checklistText, hasSpecial && styles.checklistTextActive]}>Special character (@$!%*?&)</Text>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>CONFIRM PASSWORD</Text>
                <InputField
                  placeholder="••••••••"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  iconLeft={<MaterialIcons name="loop" size={20} color={colors.textSecondary} />}
                  iconRight={
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <MaterialIcons name={showConfirmPassword ? "visibility" : "visibility-off"} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  }
                />

                <View style={{ height: 20 }} />

                {loading ? (
                  <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 20 }} />
                ) : (
                  <PrimaryButton
                    title="Update Password"
                    onPress={handleResetPassword}
                    style={styles.actionBtn}
                  />
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoiding: {
    width: '100%',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
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
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 20,
  },
  mainTitle: {
    ...typography.h2,
    marginBottom: 12,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  highlightText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 36,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  otpBoxFilled: {
    borderColor: colors.textSecondary,
  },
  otpText: {
    ...typography.h3,
  },
  actionBtn: {
    marginBottom: 32,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  keypadContainer: {
    backgroundColor: '#0a0a0a',
    paddingBottom: 40,
    paddingTop: 20,
    width: Dimensions.get('window').width,
    paddingHorizontal: 24,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  keypadButton: {
    width: 80,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadText: {
    ...typography.h2,
    fontWeight: '400',
  },
  formSection: {
    width: '100%',
    alignSelf: 'stretch',
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: 8,
    marginTop: 8,
  },
  strengthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: -8,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    backgroundColor: colors.border,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  strengthActive: {
    backgroundColor: colors.accent,
  },
  strengthTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  strengthLabel: {
    ...typography.label,
  },
  checklistContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  checklistText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 8,
  },
  checklistTextActive: {
    color: colors.accent,
  },
});
