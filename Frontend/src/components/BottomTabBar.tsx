import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.container}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    let iconName: keyof typeof MaterialIcons.glyphMap = 'help-outline';
                    if (route.name === 'Home') iconName = 'home';
                    if (route.name === 'Markets') iconName = 'trending-up';
                    if (route.name === 'Trade') iconName = 'swap-horiz';
                    if (route.name === 'Wallet') iconName = 'account-balance-wallet';
                    if (route.name === 'Profile') iconName = isFocused ? 'person' : 'person-outline';

                    const isTrade = route.name === 'Trade';

                    if (isTrade) {
                        return (
                            <TouchableOpacity
                                key={route.key}
                                accessibilityRole="button"
                                accessibilityState={isFocused ? { selected: true } : {}}
                                accessibilityLabel={options.tabBarAccessibilityLabel || 'Trade'}
                                testID={(options as any).tabBarTestID}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                activeOpacity={0.8}
                                style={styles.tradeTabItem}
                            >
                                <View style={[styles.tradeButton, isFocused && styles.tradeButtonActive]}>
                                    <MaterialIcons name="swap-horiz" size={28} color="#000000" />
                                </View>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={(options as any).tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            activeOpacity={0.7}
                            style={styles.tabItem}
                        >
                            <MaterialIcons
                                name={iconName}
                                size={26}
                                color={isFocused ? colors.accent : colors.textSecondary}
                            />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    container: {
        flexDirection: 'row',
        height: 60,
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tradeTabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tradeButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -16,
        ...Platform.select({
            ios: {
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45,
                shadowRadius: 8,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    tradeButtonActive: {
        backgroundColor: colors.accentDark,
        transform: [{ scale: 0.95 }],
    },
});


