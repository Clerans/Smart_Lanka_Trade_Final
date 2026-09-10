import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from '../theme';

interface WithdrawModalProps {
  isVisible: boolean;
  onClose: () => void;
  availableBalance: number;
  onSuccess?: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isVisible,
  onClose,
  availableBalance,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('Commercial Bank of Ceylon');
  const [loading, setLoading] = useState(false);

  const handleWithdraw = () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to withdraw.');
      return;
    }

    if (numAmount > availableBalance) {
      Alert.alert('Insufficient Balance', `You can withdraw up to LKR ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
      return;
    }

    if (!bankAccount.trim()) {
      Alert.alert('Missing Account', 'Please enter your bank account number.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Withdrawal Submitted',
        `Your withdrawal request for LKR ${numAmount.toLocaleString()} to ${bankName} (${bankAccount}) has been placed. Funds will be credited within 1-2 banking hours.`
      );
      setAmount('');
      setBankAccount('');
      if (onSuccess) onSuccess();
      onClose();
    }, 1000);
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Withdraw LKR</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.availableBox}>
            <Text style={styles.availableLabel}>Available for Withdrawal:</Text>
            <Text style={styles.availableValue}>
              LKR {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Withdrawal Amount (LKR)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>Rs</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Bank Account Number</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { fontSize: 16 }]}
                value={bankAccount}
                onChangeText={setBankAccount}
                placeholder="e.g. 8001234567"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.withdrawButton, loading && styles.disabledButton]}
            onPress={handleWithdraw}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#080B11" />
            ) : (
              <Text style={styles.withdrawButtonText}>Confirm Withdrawal</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    backgroundColor: '#0F141E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#1E2638',
    padding: 24,
    minHeight: 460,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...typography.h2,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  availableBox: {
    backgroundColor: '#161D2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242F45',
    padding: 14,
    marginBottom: 20,
  },
  availableLabel: {
    fontSize: 12,
    color: '#8E9CAE',
    marginBottom: 4,
  },
  availableValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00E676',
  },
  inputWrapper: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E9CAE',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161D2B',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#242F45',
  },
  currencyPrefix: {
    ...typography.h3,
    color: '#00E676',
    marginRight: 8,
  },
  input: {
    flex: 1,
    ...typography.h2,
    color: '#FFFFFF',
  },
  withdrawButton: {
    backgroundColor: '#00E676',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  disabledButton: {
    opacity: 0.7,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080B11',
  },
});
