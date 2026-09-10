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
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { walletService } from '../services/apiService';

interface TransferModalProps {
  isVisible: boolean;
  onClose: () => void;
  availableBalance: number;
  onSuccess?: () => void;
}

interface RecipientInfo {
  accountUid: string;
  name: string;
  isVerified: boolean;
  kycStatus: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isVisible,
  onClose,
  availableBalance,
  onSuccess
}) => {
  const [step, setStep] = useState<'LOOKUP' | 'AMOUNT' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS'>('LOOKUP');
  const [recipientUid, setRecipientUid] = useState('');
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [message, setMessage] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const resetState = () => {
    setStep('LOOKUP');
    setRecipientUid('');
    setRecipient(null);
    setLookupLoading(false);
    setAmount('10000');
    setMessage('');
    setTransferLoading(false);
    setReceipt(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleLookup = async () => {
    const cleanUid = recipientUid.trim().toUpperCase();
    if (!cleanUid) {
      Alert.alert('Missing UID', 'Please enter a recipient Account UID (e.g. SLT-8F42K91).');
      return;
    }

    setLookupLoading(true);
    try {
      const res = await walletService.lookupRecipient(cleanUid);
      if (res?.success && res.data) {
        setRecipient(res.data);
        setStep('AMOUNT');
      } else {
        throw new Error(res?.message || 'User not found.');
      }
    } catch (error: any) {
      Alert.alert(
        'Recipient Not Found',
        error.message || `No SmartLanka Trade account found with UID "${cleanUid}".`
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const numAmount = parseFloat(amount || '0');

  const handleProceedToConfirm = () => {
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
      return;
    }

    if (numAmount > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `Available balance: LKR ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      );
      return;
    }

    setStep('CONFIRM');
  };

  const handleExecuteTransfer = async () => {
    if (!recipient) return;
    setTransferLoading(true);
    setStep('PROCESSING');

    try {
      const idempotencyKey = `trf-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const res = await walletService.transfer(
        recipient.accountUid,
        numAmount,
        message.trim() || undefined,
        idempotencyKey
      );

      if (res?.success) {
        setReceipt({
          transactionId: res.data.transactionId,
          reference: res.data.transferReference,
          amount: numAmount,
          recipient: res.data.recipient,
          availableBalance: res.data.availableBalance,
          date: new Date().toLocaleString()
        });
        setStep('SUCCESS');
        if (onSuccess) onSuccess();
      } else {
        throw new Error(res?.message || 'Transfer failed.');
      }
    } catch (error: any) {
      Alert.alert('Transfer Failed', error.message || 'Could not complete wallet transfer.');
      setStep('AMOUNT');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {step === 'LOOKUP' && 'Send LKR'}
                {step === 'AMOUNT' && 'Transfer Funds'}
                {step === 'CONFIRM' && 'Confirm Transfer'}
                {step === 'PROCESSING' && 'Executing Transfer'}
                {step === 'SUCCESS' && 'Transfer Complete'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === 'LOOKUP' && 'Enter recipient SmartLanka Trade UID'}
                {step === 'AMOUNT' && 'Specify amount and optional note'}
                {step === 'CONFIRM' && 'Review instant P2P transfer details'}
                {step === 'PROCESSING' && 'Atomic dual-wallet ledger update...'}
                {step === 'SUCCESS' && 'Funds delivered instantly'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* STEP 1: RECIPIENT UID LOOKUP */}
          {step === 'LOOKUP' && (
            <View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>RECIPIENT UID</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="person-search" size={22} color={colors.accent} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.uidInput}
                    value={recipientUid}
                    onChangeText={setRecipientUid}
                    placeholder="SLT-XXXXXXXX"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.helperText}>
                  Enter the recipient's 8-character unique SmartLanka UID.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, lookupLoading && styles.btnDisabled]}
                onPress={handleLookup}
                disabled={lookupLoading}
                activeOpacity={0.85}
              >
                {lookupLoading ? (
                  <ActivityIndicator color="#080B11" />
                ) : (
                  <Text style={styles.primaryBtnText}>Find User</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: AMOUNT & NOTE INPUT */}
          {step === 'AMOUNT' && recipient && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Recipient Found Card */}
              <View style={styles.recipientFoundCard}>
                <View style={styles.recipientAvatar}>
                  <MaterialIcons name="person" size={24} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientFoundName}>{recipient.name}</Text>
                  <Text style={styles.recipientFoundUid}>{recipient.accountUid}</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <MaterialIcons name="verified" size={14} color={colors.accent} />
                  <Text style={styles.verifiedBadgeText}>
                    {recipient.kycStatus === 'VERIFIED' ? 'Verified' : 'Active'}
                  </Text>
                </View>
              </View>

              {/* Available Cash Banner */}
              <View style={styles.availableBox}>
                <Text style={styles.availableLabel}>AVAILABLE CASH</Text>
                <Text style={styles.availableValue}>
                  LKR {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Amount Input */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>AMOUNT TO SEND</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencyPrefix}>Rs</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.maxBtn}
                    onPress={() => setAmount(availableBalance.toFixed(2))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Message Input (Optional) */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>MESSAGE / NOTE (OPTIONAL)</Text>
                <View style={[styles.inputContainer, { height: 50 }]}>
                  <TextInput
                    style={[styles.amountInput, { fontSize: 14 }]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="e.g. For dinner / trade split"
                    placeholderTextColor={colors.textMuted}
                    maxLength={80}
                  />
                </View>
              </View>

              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep('LOOKUP')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backBtnText}>Change User</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmPrimaryBtn}
                  onPress={handleProceedToConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* STEP 3: CONFIRMATION */}
          {step === 'CONFIRM' && recipient && (
            <View>
              <View style={styles.confirmBox}>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>From</Text>
                  <Text style={styles.confirmValue}>My Trading Wallet</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>To Recipient</Text>
                  <Text style={styles.confirmValueBold}>{recipient.name}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Recipient UID</Text>
                  <Text style={styles.confirmValueAccent}>{recipient.accountUid}</Text>
                </View>
                {message ? (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Note</Text>
                    <Text style={styles.confirmValue}>{message}</Text>
                  </View>
                ) : null}

                <View style={styles.confirmDivider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Amount</Text>
                  <Text style={styles.confirmValueBold}>
                    LKR {numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Network Fee</Text>
                  <Text style={styles.confirmFreeText}>LKR 0.00 (Instant & Free)</Text>
                </View>

                <View style={styles.confirmDivider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabelBold}>Total Deducted</Text>
                  <Text style={styles.confirmValueAccentLarge}>
                    LKR {numAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <View style={styles.actionBtnRow}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setStep('AMOUNT')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmPrimaryBtn}
                  onPress={handleExecuteTransfer}
                  activeOpacity={0.85}
                  disabled={transferLoading}
                >
                  <Text style={styles.primaryBtnText}>Confirm Transfer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 4: PROCESSING */}
          {step === 'PROCESSING' && (
            <View style={styles.centerStatusBox}>
              <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 20 }} />
              <Text style={styles.statusTitle}>Executing Internal Transfer</Text>
              <Text style={styles.statusSub}>
                Applying dual-wallet row locking and recording ledger transaction...
              </Text>
            </View>
          )}

          {/* STEP 5: SUCCESS RECEIPT */}
          {step === 'SUCCESS' && receipt && (
            <View>
              <View style={styles.successIconCircle}>
                <MaterialIcons name="check" size={32} color="#080B11" />
              </View>

              <View style={styles.receiptBox}>
                <Text style={styles.receiptAmount}>
                  LKR {receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.receiptSub}>Transfer Sent Successfully</Text>

                <View style={styles.confirmDivider} />

                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Sent To</Text>
                  <Text style={styles.confirmValueBold}>{receipt.recipient?.name}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Recipient UID</Text>
                  <Text style={styles.confirmValueAccent}>{receipt.recipient?.accountUid}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Reference</Text>
                  <Text style={[styles.confirmValue, { fontSize: 11 }]}>{receipt.reference}</Text>
                </View>
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Status</Text>
                  <Text style={styles.confirmValueAccent}>COMPLETED</Text>
                </View>
                {receipt.availableBalance !== undefined && (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmLabel}>Remaining Balance</Text>
                    <Text style={styles.confirmValueBold}>
                      LKR {receipt.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleClose}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    minHeight: 450,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 18,
    paddingHorizontal: 18,
    height: 58,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uidInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.accent,
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
  maxBtn: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  recipientFoundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 16,
  },
  recipientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recipientFoundName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recipientFoundUid: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  availableBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  availableLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  availableValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 20 : 6,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#080B11',
  },
  confirmBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  confirmLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  confirmLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  confirmValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  confirmValueAccent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  confirmValueAccentLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  confirmFreeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 20 : 6,
  },
  backBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  confirmPrimaryBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerStatusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  statusSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  receiptAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.accent,
    textAlign: 'center',
  },
  receiptSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
