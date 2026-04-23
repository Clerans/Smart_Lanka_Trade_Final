import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton } from '../../components';

export const OTPVerificationScreen = () => {
  const navigation = useNavigation<any>();
  const [otp, setOtp] = useState<string>('');
  const [timer, setTimer] = useState(59);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleKeyPress = (num: string) => {
    if (otp.length < 6) {
      setOtp(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setOtp(prev => prev.slice(0, -1));
  };

  const handleBiometric = () => {
    // Implement biometric auth logic
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Identity</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="security" size={48} color={colors.accent} />
          </View>

          <Text style={styles.mainTitle}>OTP Verification</Text>
          <Text style={styles.description}>
            A verification code has been sent to your registered mobile number <Text style={styles.highlightText}>+94 ••••••1234</Text> for secure access.
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

          {/* Resend Timer */}
          <Text style={styles.didNotReceive}>Didn't receive the code?</Text>
          <View style={styles.timerRow}>
            <View style={styles.timerPill}>
              <MaterialIcons name="access-time" size={16} color={colors.accent} />
              <Text style={styles.timerText}>
                00:{timer < 10 ? `0${timer}` : timer}
              </Text>
            </View>
            <TouchableOpacity disabled={timer > 0}>
              <Text style={[styles.resendText, timer > 0 && styles.resendTextDisabled]}>
                Resend OTP
              </Text>
            </TouchableOpacity>
          </View>

          <PrimaryButton
            title="Verify →"
            onPress={() => navigation.navigate('KYCVerification')}
            style={styles.verifyBtn}
          />

          <Text style={styles.securityBadge}>
            SMARTLANKA TRADE SECURITY
          </Text>
        </View>

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
            <TouchableOpacity style={styles.keypadButton} onPress={handleBiometric}>
              <MaterialIcons name="fingerprint" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeyPress('0')}>
              <Text style={styles.keypadText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={handleDelete}>
              <FontAwesome5 name="backspace" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
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
    marginBottom: 32,
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
  didNotReceive: {
    ...typography.bodySmall,
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 16,
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
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: colors.textMuted,
  },
  verifyBtn: {
    marginBottom: 32,
  },
  securityBadge: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 20,
  },
  keypadContainer: {
    backgroundColor: '#0a0a0a',
    paddingBottom: 40,
    paddingTop: 20,
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
});
