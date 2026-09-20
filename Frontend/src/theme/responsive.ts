import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design baseline (based on standard 375 x 812 dp mobile viewport)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Linear horizontal scaling helper
 */
export const scale = (size: number): number => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Linear vertical scaling helper
 */
export const verticalScale = (size: number): number => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Moderate scaling with dampening factor (default: 0.5)
 * Ideal for responsive padding, fonts, and icon sizes without exaggerated scaling on tablets
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  return size + (scale(size) - size) * factor;
};

/**
 * Width percentage to DP helper (e.g. wp(50) = 50% of screen width)
 */
export const wp = (percentage: number): number => {
  return (percentage * SCREEN_WIDTH) / 100;
};

/**
 * Height percentage to DP helper (e.g. hp(20) = 20% of screen height)
 */
export const hp = (percentage: number): number => {
  return (percentage * SCREEN_HEIGHT) / 100;
};

/**
 * Screen device category detectors
 */
export const isSmallDevice = SCREEN_WIDTH <= 360;
export const isTablet = SCREEN_WIDTH >= 600;

export const SCREEN_PADDING = isSmallDevice ? 14 : 16;
export const TAB_BAR_BOTTOM_OFFSET = 96;

export const responsive = {
  scale,
  verticalScale,
  moderateScale,
  wp,
  hp,
  isSmallDevice,
  isTablet,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  SCREEN_PADDING,
  TAB_BAR_BOTTOM_OFFSET,
};
