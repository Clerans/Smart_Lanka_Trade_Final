import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { formatLKR } from '../utils/formatters';

export interface TransactionItem {
  id: number;
  type: string;
  amount: number;
  symbol?: string;
  status: string;
  paymentMethod?: string;
  reference?: string;
  recipientUid?: string;
  description?: string;
  failureReason?: string;
  isIncoming?: boolean;
  createdAt: string;
}

interface TransactionDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  transaction: TransactionItem | null;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isVisible,
  onClose,
  transaction
}) => {
  if (!transaction) return null;

  const rawType = transaction.type || (transaction as any).TYPE || 'TRANSACTION';
  const isIncoming = transaction.isIncoming !== undefined 
    ? transaction.isIncoming 
    : ['DEPOSIT', 'TRANSFER_RECEIVED', 'SELL'].includes(rawType);

  const rawStatus = transaction.status || (transaction as any).STATUS || 'COMPLETED';
  const rawAmount = transaction.amount !== undefined 
    ? transaction.amount 
    : ((transaction as any).AMOUNT !== undefined ? (transaction as any).AMOUNT : ((transaction as any).total || 0));

  const getStatusColor = (st: string) => {
    switch ((st || '').toUpperCase()) {
      case 'COMPLETED':
        return colors.accent;
      case 'PROCESSING':
      case 'PENDING':
        return '#FFB300';
      case 'FAILED':
      case 'CANCELLED':
        return '#FF5252';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusBg = (st: string) => {
    switch ((st || '').toUpperCase()) {
      case 'COMPLETED':
        return colors.accentMuted;
      case 'PROCESSING':
      case 'PENDING':
        return '#FFB30022';
      case 'FAILED':
      case 'CANCELLED':
        return '#FF525222';
      default:
        return colors.bgElevated;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'arrow-downward';
      case 'WITHDRAW':
        return 'arrow-upward';
      case 'TRANSFER_SENT':
        return 'arrow-forward';
      case 'TRANSFER_RECEIVED':
        return 'arrow-back';
      case 'BUY':
        return 'shopping-cart';
      case 'SELL':
        return 'sell';
      default:
        return 'swap-horiz';
    }
  };

  const getFormattedType = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'Wallet Deposit';
      case 'WITHDRAW':
        return 'Cash Withdrawal';
      case 'TRANSFER_SENT':
        return 'Transfer Sent';
      case 'TRANSFER_RECEIVED':
        return 'Transfer Received';
      case 'BUY':
        return 'Asset Purchase';
      case 'SELL':
        return 'Asset Liquidation';
      default:
        return type;
    }
  };

  const dateStr = transaction.createdAt || (transaction as any).CREATED_AT;
  const formattedDate = dateStr 
    ? new Date(dateStr).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Recent';

  const txId = transaction.id || (transaction as any).ID || '---';
  const method = transaction.paymentMethod || (transaction as any).PAYMENT_METHOD || null;
  const ref = transaction.reference || (transaction as any).PROVIDER_REF || null;
  const recipientUid = transaction.recipientUid || (transaction as any).RECIPIENT_UID || null;
  const desc = transaction.description || (transaction as any).DESCRIPTION || '';
  const failureReason = transaction.failureReason || (transaction as any).FAILURE_REASON || null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Transaction Receipt</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Amount & Type Hero Card */}
            <View style={styles.heroCard}>
              <View style={[styles.typeIconCircle, { backgroundColor: isIncoming ? colors.accentMuted : '#FF525222' }]}>
                <MaterialIcons
                  name={getTypeIcon(rawType)}
                  size={26}
                  color={isIncoming ? colors.accent : '#FF5252'}
                />
              </View>

              <Text style={[styles.amountText, { color: isIncoming ? colors.accent : '#FFFFFF' }]}>
                {isIncoming ? '+' : '-'} LKR {formatLKR(rawAmount, 2)}
              </Text>
              <Text style={styles.typeLabel}>{getFormattedType(rawType)}</Text>

              {/* Status Pill */}
              <View style={[styles.statusPill, { backgroundColor: getStatusBg(rawStatus) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(rawStatus) }]}>
                  {rawStatus}
                </Text>
              </View>
            </View>

            {/* Receipt Details Card */}
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID</Text>
                <Text style={styles.detailValue}>#{txId}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>{formattedDate}</Text>
              </View>

              {method ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Method</Text>
                  <Text style={styles.detailValueAccent}>{method}</Text>
                </View>
              ) : null}

              {ref ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Reference ID</Text>
                  <Text style={[styles.detailValue, { fontSize: 11 }]}>{ref}</Text>
                </View>
              ) : null}

              {recipientUid ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Counterparty UID</Text>
                  <Text style={styles.detailValueAccent}>{recipientUid}</Text>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Network Fee</Text>
                <Text style={styles.detailFree}>LKR 0.00 (Free)</Text>
              </View>

              {desc ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.noteGroup}>
                    <Text style={styles.detailLabel}>Description / Note</Text>
                    <Text style={styles.noteText}>{desc}</Text>
                  </View>
                </>
              ) : null}

              {failureReason ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.noteGroup}>
                    <Text style={[styles.detailLabel, { color: '#FF5252' }]}>Failure Reason</Text>
                    <Text style={[styles.noteText, { color: '#FF5252' }]}>{failureReason}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Close Receipt</Text>
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
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
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  typeIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailsCard: {
    backgroundColor: colors.bgInput,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailValueAccent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  detailFree: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  noteGroup: {
    marginTop: 4,
  },
  noteText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 4,
    lineHeight: 18,
  },
  doneBtn: {
    backgroundColor: colors.bgElevated,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Platform.OS === 'ios' ? 20 : 6,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
