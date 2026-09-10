import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  LayoutChangeEvent
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const [layoutWidth, setLayoutWidth] = useState(Dimensions.get('window').width);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && width !== layoutWidth) {
      setLayoutWidth(width);
    }
  };

  const width = layoutWidth || Dimensions.get('window').width;
  const barHeight = 56;
  const topY = 16;
  const notchDepth = 34;
  const bottomInset = Math.max(insets.bottom, 12);
  const totalHeight = barHeight + topY + bottomInset;
  const cX = width / 2;

  // Ultra-smooth scoop curve matching reference design
  const bgPath = `
    M 0,${topY}
    L ${cX - 48},${topY}
    C ${cX - 34},${topY} ${cX - 28},${topY + notchDepth} ${cX},${topY + notchDepth}
    C ${cX + 28},${topY + notchDepth} ${cX + 34},${topY} ${cX + 48},${topY}
    L ${width},${topY}
    L ${width},${totalHeight}
    L 0,${totalHeight}
    Z
  `;

  const borderPath = `
    M 0,${topY}
    L ${cX - 48},${topY}
    C ${cX - 34},${topY} ${cX - 28},${topY + notchDepth} ${cX},${topY + notchDepth}
    C ${cX + 28},${topY + notchDepth} ${cX + 34},${topY} ${cX + 48},${topY}
    L ${width},${topY}
  `;

  return (
    <View style={styles.outerContainer} onLayout={onLayout}>
      {/* Curved Tab Bar SVG Background matching app theme */}
      <Svg
        width={width}
        height={totalHeight}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      >
        <Path d={bgPath} fill={colors.bgCard || "#111111"} />
        <Path d={borderPath} stroke={colors.border || "#262626"} strokeWidth={1} fill="none" />
      </Svg>

      {/* Tab Navigation Items */}
      <View style={[styles.tabRow, { paddingTop: topY + 4, paddingBottom: bottomInset }]}>
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

          // Center Swap / Trade Button
          if (route.name === 'Trade') {
            return (
              <View key={route.key} style={styles.centerItemWrapper}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel || 'Trade'}
                  testID={(options as any).tabBarTestID}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  activeOpacity={0.85}
                  style={[styles.floatingActionBtn, isFocused && styles.floatingActionBtnActive]}
                >
                  <MaterialIcons name="swap-horiz" size={28} color="#06090E" />
                </TouchableOpacity>
              </View>
            );
          }

          // Left and Right Tab Navigation Items
          let label = route.name;
          let iconName: keyof typeof MaterialIcons.glyphMap = 'help-outline';

          if (route.name === 'Home') {
            label = 'Home';
            iconName = 'home';
          } else if (route.name === 'Markets') {
            label = 'Markets';
            iconName = 'trending-up';
          } else if (route.name === 'Wallet') {
            label = 'Wallet';
            iconName = 'account-balance-wallet';
          } else if (route.name === 'Profile') {
            label = 'Profile';
            iconName = 'person';
          }

          const activeColor = colors.accent || '#00E676';
          const inactiveColor = colors.textSecondary || '#8A8A8A';
          const itemColor = isFocused ? activeColor : inactiveColor;

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
                size={23}
                color={itemColor}
              />
              <Text style={[styles.tabLabel, { color: itemColor }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
    elevation: 0,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  centerItemWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  floatingActionBtn: {
    position: 'absolute',
    top: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00E676',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00FF88',
    ...Platform.select({
      ios: {
        shadowColor: '#00E676',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  floatingActionBtnActive: {
    backgroundColor: '#00C853',
    transform: [{ scale: 0.95 }],
  },
});


