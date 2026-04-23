import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';

export const SOMIAIChatScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <MaterialIcons name="menu" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>SOMI - AI Helpdesk</Text>
            <View style={styles.statusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusText}>ONLINE</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="more-vert" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Chat Area */}
        <ScrollView contentContainerStyle={styles.chatScroll} showsVerticalScrollIndicator={false}>

          {/* AI Message */}
          <View style={styles.messageRow}>
            <View style={styles.aiAvatar}>
              <FontAwesome5 name="robot" size={14} color="#000" />
            </View>
            <View style={styles.messageBubbleAi}>
              <Text style={styles.messageLabelText}>SOMI AI</Text>
              <Text style={styles.messageTextWhite}>
                Hello! I'm SOMI, your financial assistant. How can I help you manage your assets today?
              </Text>
              <Text style={styles.messageTimestamp}>10:00 AM</Text>
            </View>
          </View>

          {/* User Message */}
          <View style={[styles.messageRow, styles.messageRowUser]}>
            <View style={styles.messageBubbleUser}>
              <Text style={styles.messageLabelTextUser}>YOU</Text>
              <Text style={styles.messageTextBlack}>
                Can you analyze my portfolio's performance for this month?
              </Text>
              <Text style={styles.messageTimestampUser}>10:01 AM</Text>
            </View>
          </View>

          {/* AI Message */}
          <View style={styles.messageRow}>
            <View style={styles.aiAvatar}>
              <FontAwesome5 name="robot" size={14} color="#000" />
            </View>
            <View style={styles.messageBubbleAi}>
              <Text style={styles.messageLabelText}>SOMI AI</Text>
              <Text style={styles.messageTextWhite}>
                Certainly. Your portfolio is up <Text style={styles.highlightText}>4.2%</Text> this month, largely driven by tech stocks and your recent Ethereum position. Would you like a detailed breakdown?
              </Text>
              <Text style={styles.messageTimestamp}>10:01 AM</Text>
            </View>
          </View>

          {/* Typing Indicator */}
          <View style={styles.messageRow}>
            <View style={styles.aiAvatar}>
              <FontAwesome5 name="robot" size={14} color="#000" />
            </View>
            <View style={[styles.messageBubbleAi, styles.typingBubble]}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesScroll}>
            <TouchableOpacity style={styles.quickReplyPill}>
              <Text style={styles.quickReplyText}>↗ Explain this prediction</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickReplyPill}>
              <Text style={styles.quickReplyText}>🛒 Is now a good time to buy</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.plusBtn}>
              <MaterialIcons name="add" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask SOMI anything..."
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity style={styles.sendBtn}>
              <MaterialIcons name="arrow-upward" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimerText}>
            SOMI can make mistakes. Check important info.
          </Text>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    padding: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 4,
  },
  statusText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
  },
  chatScroll: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageBubbleAi: {
    backgroundColor: colors.bgCard,
    padding: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  messageLabelText: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  messageLabelTextUser: {
    ...typography.label,
    color: '#00000080',
    marginBottom: 6,
  },
  messageTextWhite: {
    ...typography.body,
    color: '#FFF',
    lineHeight: 22,
  },
  messageTextBlack: {
    ...typography.body,
    color: '#000',
    lineHeight: 22,
  },
  highlightText: {
    color: colors.accent,
    fontWeight: '700',
  },
  messageTimestamp: {
    ...typography.bodySmall,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  messageTimestampUser: {
    ...typography.bodySmall,
    fontSize: 10,
    color: '#00000099',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginHorizontal: 2,
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: colors.bg,
  },
  quickRepliesScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  quickReplyPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
    marginRight: 12,
  },
  quickReplyText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    paddingLeft: 8,
    paddingRight: 8,
    height: 56,
    marginBottom: 12,
  },
  plusBtn: {
    padding: 8,
  },
  chatInput: {
    ...typography.body,
    flex: 1,
    height: '100%',
    color: colors.textPrimary,
    paddingHorizontal: 12,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disclaimerText: {
    ...typography.bodySmall,
    fontSize: 10,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
