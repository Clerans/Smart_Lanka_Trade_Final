import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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

                    // Icon selection matching premium fintech look
                    let iconName: keyof typeof MaterialIcons.glyphMap = 'help-outline';
                    if (route.name === 'Home') iconName = isFocused ? 'home' : 'home';
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
                                activeOpacity={0.85}
                                style={styles.tradeTabItem}
                            >
                                <View style={styles.tradeOuterRing}>
                                    <View style={[styles.tradeButton, isFocused && styles.tradeButtonActive]}>
                                        <MaterialIcons name="compare-arrows" size={28} color="#000000" />
                                    </View>
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
                            <View style={styles.iconContainer}>
                                <MaterialIcons
                                    name={iconName}
                                    size={24}
                                    color={isFocused ? '#00E676' : '#6B7A90'}
                                />
                                {isFocused && <View style={styles.activeDot} />}
                            </View>
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
        paddingHorizontal: 12,
    },
    tabItem: {
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    activeDot: {
        position: 'absolute',
        bottom: -6,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.accent,
    },
    tradeTabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    tradeOuterRing: {
        top: -16,
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: colors.bg,
        padding: 3,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    tradeButton: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.55,
                shadowRadius: 10,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    tradeButtonActive: {
        backgroundColor: colors.accentDark,
        transform: [{ scale: 0.96 }],
    },
});


