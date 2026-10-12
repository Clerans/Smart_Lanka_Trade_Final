import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent
} from 'react-native';
import Svg, {
  Rect,
  Line,
  Path,
  Text as SvgText,
  G,
  Defs,
  LinearGradient as SvgGradient,
  Stop
} from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../theme';
import { marketService } from '../services/apiService';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
  openLKR?: number;
  highLKR?: number;
  lowLKR?: number;
  closeLKR?: number;
  sma20?: number | null;
  sma20LKR?: number | null;
  ema50?: number | null;
  ema50LKR?: number | null;
}

export interface CandlestickChartProps {
  symbol: string;
  initialInterval?: string;
  onTimeframeChange?: (interval: string) => void;
  onPriceUpdate?: (latestPriceLKR: number, change24h: number) => void;
}

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1D', value: '1d' }
];

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol = 'BTCUSDT',
  initialInterval = '1h',
  onTimeframeChange,
  onPriceUpdate
}) => {
  const [interval, setIntervalState] = useState<string>(initialInterval);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [usdToLkr, setUsdToLkr] = useState<number>(328.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLkrMode, setIsLkrMode] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'live' | 'stale' | 'disconnected'>('live');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const consecutiveErrorsRef = useRef<number>(0);

  // Overlay toggles
  const [showSMA, setShowSMA] = useState<boolean>(true);
  const [showEMA, setShowEMA] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Layout & Interactive touch state
  const [chartWidth, setChartWidth] = useState<number>(340);
  const chartHeight = 270;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const fetchKlines = async (targetInterval: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await marketService.getKlines(symbol, targetInterval, 45);

      if (res?.success && Array.isArray(res.data?.candles) && res.data.candles.length > 0) {
        // Validate candle integrity & timestamps
        const validCandles = res.data.candles
          .filter((c: Candle) => (
            typeof c.timestamp === 'number' &&
            !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close) &&
            c.open > 0 && c.close > 0
          ))
          .sort((a: Candle, b: Candle) => a.timestamp - b.timestamp);

        if (validCandles.length > 0) {
          setCandles(validCandles);
          if (res.data.usdToLkr) setUsdToLkr(res.data.usdToLkr);
          setConnectionStatus('live');
          setLastUpdated(Date.now());
          consecutiveErrorsRef.current = 0;

          const last = validCandles[validCandles.length - 1];
          if (last && onPriceUpdate) {
            const lkrPrice = last.closeLKR || (last.close * (res.data.usdToLkr || 328.2));
            const change = res.data.change24h ?? 0;
            onPriceUpdate(lkrPrice, change);
          }
        } else {
          throw new Error('Received malformed candlestick data.');
        }
      } else {
        throw new Error('No historical candle data received.');
      }
    } catch (err: any) {
      console.warn('CandlestickChart fetch error:', err.message);
      setConnectionStatus('disconnected');
      setError('Unable to load live market chart. Tap to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKlines(interval);
  }, [symbol, interval]);

  // Live polling for latest tick (every 8s)
  useEffect(() => {
    const liveTimer = setInterval(async () => {
      try {
        const liveRes = await marketService.getPriceLKR(symbol);
        const payload = liveRes?.data || liveRes;
        if (payload && (payload.priceUSDT || payload.priceLKR)) {
          const currentUSD = payload.priceUSDT || (payload.priceLKR / (payload.usdToLkr || usdToLkr));
          const currentRate = payload.usdToLkr || usdToLkr;
          const currentLKR = payload.priceLKR || (currentUSD * currentRate);

          if (onPriceUpdate) {
            onPriceUpdate(currentLKR, payload.changePercent ?? 0);
          }

          // Dynamically update the currently active candle in the series
          setCandles(prev => {
            if (!prev || prev.length === 0) return prev;
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            const activeCandle = { ...updated[lastIdx] };

            activeCandle.high = Math.max(activeCandle.high, currentUSD);
            activeCandle.low = Math.min(activeCandle.low, currentUSD);
            activeCandle.close = currentUSD;
            activeCandle.highLKR = activeCandle.high * currentRate;
            activeCandle.lowLKR = activeCandle.low * currentRate;
            activeCandle.closeLKR = currentLKR;

            // Update volume only from valid volume payload
            if (typeof payload.volume === 'number' && payload.volume > 0) {
              activeCandle.volume = payload.volume;
            }

            updated[lastIdx] = activeCandle;
            return updated;
          });

          setConnectionStatus('live');
          setLastUpdated(Date.now());
          consecutiveErrorsRef.current = 0;
        } else {
          throw new Error('Incomplete ticker data received');
        }
      } catch (e) {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 3) {
          setConnectionStatus('disconnected');
        } else if (consecutiveErrorsRef.current >= 1) {
          setConnectionStatus('stale');
        }
      }
    }, 8000);

    return () => clearInterval(liveTimer);
  }, [symbol, usdToLkr]);

  const handleIntervalSelect = (newInterval: string) => {
    if (newInterval === interval) return;
    setIntervalState(newInterval);
    setSelectedIndex(null);
    if (onTimeframeChange) onTimeframeChange(newInterval);
  };

  // Dimensions & bounds calculations
  const yAxisWidth = 58;
  const plotWidth = Math.max(chartWidth - yAxisWidth, 100);
  const mainPriceHeight = showVolume ? 175 : 225;
  const volumeHeight = showVolume ? 45 : 0;
  const volumeTop = mainPriceHeight + 8;
  const timeAxisHeight = 22;

  const { minPrice, maxPrice, maxVolume, priceLevels } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { minPrice: 0, maxPrice: 1, maxVolume: 1, priceLevels: [] };
    }

    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    candles.forEach(c => {
      const low = isLkrMode ? (c.lowLKR || c.low * usdToLkr) : c.low;
      const high = isLkrMode ? (c.highLKR || c.high * usdToLkr) : c.high;
      if (low < min) min = low;
      if (high > max) max = high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    const padding = (max - min) * 0.08 || 1;
    const finalMin = min - padding;
    const finalMax = max + padding;

    // Calculate 4 horizontal price guide levels
    const step = (finalMax - finalMin) / 4;
    const levels = [
      finalMax,
      finalMin + step * 3,
      finalMin + step * 2,
      finalMin + step,
      finalMin
    ];

    return { minPrice: finalMin, maxPrice: finalMax, maxVolume: maxVol || 1, priceLevels: levels };
  }, [candles, isLkrMode, usdToLkr]);

  const priceToY = (price: number) => {
    if (maxPrice === minPrice) return mainPriceHeight / 2;
    return 10 + (1 - (price - minPrice) / (maxPrice - minPrice)) * (mainPriceHeight - 20);
  };

  const volToHeight = (vol: number) => {
    if (maxVolume === 0) return 0;
    return Math.max((vol / maxVolume) * (volumeHeight - 8), 2);
  };

  // Pan responder for scrubbing / crosshair
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const touchX = evt.nativeEvent.locationX;
        updateCrosshair(touchX);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const touchX = evt.nativeEvent.locationX;
        updateCrosshair(touchX);
      },
      onPanResponderRelease: () => {
        // Keep selected index for reading or tap outside to clear
      }
    });
  }, [candles, plotWidth]);

  const updateCrosshair = (touchX: number) => {
    if (!candles || candles.length === 0) return;
    const num = candles.length;
    const slotWidth = plotWidth / num;
    const idx = Math.min(Math.max(Math.floor(touchX / slotWidth), 0), num - 1);
    setSelectedIndex(idx);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 100) setChartWidth(w);
  };

  // Generate SVG path strings for indicators
  const smaPath = useMemo(() => {
    if (!showSMA || candles.length === 0) return '';
    const slotWidth = plotWidth / candles.length;
    let path = '';
    candles.forEach((c, idx) => {
      const sma = isLkrMode ? c.sma20LKR : c.sma20;
      if (sma) {
        const x = idx * slotWidth + slotWidth / 2;
        const y = priceToY(sma);
        path += path === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
    });
    return path;
  }, [candles, showSMA, isLkrMode, plotWidth, minPrice, maxPrice]);

  const emaPath = useMemo(() => {
    if (!showEMA || candles.length === 0) return '';
    const slotWidth = plotWidth / candles.length;
    let path = '';
    candles.forEach((c, idx) => {
      const ema = isLkrMode ? c.ema50LKR : c.ema50;
      if (ema) {
        const x = idx * slotWidth + slotWidth / 2;
        const y = priceToY(ema);
        path += path === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
    });
    return path;
  }, [candles, showEMA, isLkrMode, plotWidth, minPrice, maxPrice]);

  // Active or latest candle for HUD display
  const activeCandle = selectedIndex !== null && candles[selectedIndex] 
    ? candles[selectedIndex] 
    : candles[candles.length - 1];

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    if (isLkrMode) {
      return val >= 1000000 
        ? `${(val / 1000000).toFixed(2)}M` 
        : val >= 1000 
        ? `${(val / 1000).toFixed(1)}k` 
        : val.toFixed(0);
    }
    return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(2);
  };

  const formatHUDPrice = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    if (interval === '1d') {
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Timeframe & Display Mode Header */}
      <View style={styles.topControlRow}>
        <View style={styles.timeframeRow}>
          {TIMEFRAMES.map(tf => {
            const isActive = interval === tf.value;
            return (
              <TouchableOpacity
                key={tf.value}
                style={[styles.timeframeBtn, isActive && styles.timeframeBtnActive]}
                onPress={() => handleIntervalSelect(tf.value)}
              >
                <Text style={[styles.timeframeText, isActive && styles.timeframeTextActive]}>
                  {tf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.indicatorToggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, showSMA && styles.toggleBtnActive]}
            onPress={() => setShowSMA(!showSMA)}
          >
            <Text style={[styles.toggleBtnText, showSMA && { color: '#FFA726' }]}>MA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, showEMA && styles.toggleBtnActive]}
            onPress={() => setShowEMA(!showEMA)}
          >
            <Text style={[styles.toggleBtnText, showEMA && { color: '#29B6F6' }]}>EMA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isLkrMode && styles.toggleBtnActive]}
            onPress={() => setIsLkrMode(!isLkrMode)}
          >
            <Text style={[styles.toggleBtnText, isLkrMode && { color: colors.accent }]}>
              {isLkrMode ? 'LKR' : 'USD'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Candle Inspection HUD */}
      {activeCandle && (
        <View style={styles.hudRow}>
          <View style={styles.hudItem}>
            <Text style={styles.hudLabel}>TIME</Text>
            <Text style={styles.hudValue}>{formatTime(activeCandle.timestamp)}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudLabel}>O</Text>
            <Text style={styles.hudValue}>{formatHUDPrice(isLkrMode ? activeCandle.openLKR : activeCandle.open)}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudLabel}>H</Text>
            <Text style={[styles.hudValue, { color: colors.accent }]}>{formatHUDPrice(isLkrMode ? activeCandle.highLKR : activeCandle.high)}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudLabel}>L</Text>
            <Text style={[styles.hudValue, { color: colors.red }]}>{formatHUDPrice(isLkrMode ? activeCandle.lowLKR : activeCandle.low)}</Text>
          </View>
          <View style={styles.hudItem}>
            <Text style={styles.hudLabel}>C</Text>
            <Text style={[styles.hudValue, { color: (activeCandle.close >= activeCandle.open) ? colors.accent : colors.red }]}>
              {formatHUDPrice(isLkrMode ? activeCandle.closeLKR : activeCandle.close)}
            </Text>
          </View>
          {showVolume && (
            <View style={styles.hudItem}>
              <Text style={styles.hudLabel}>VOL</Text>
              <Text style={styles.hudValue}>{(activeCandle.volume).toFixed(1)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Main Chart Canvas Area */}
      <View style={styles.chartCanvasContainer} {...panResponder.panHandlers}>
        {loading && candles.length === 0 ? (
          <View style={styles.chartLoadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading live Binance candlestick feed...</Text>
          </View>
        ) : error && candles.length === 0 ? (
          <TouchableOpacity style={styles.chartErrorOverlay} onPress={() => fetchKlines(interval)}>
            <MaterialIcons name="error-outline" size={32} color={colors.red} />
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Svg width={chartWidth} height={chartHeight}>
            {/* Background Grid Lines & Price Labels */}
            {priceLevels.map((lvl, i) => {
              const y = priceToY(lvl);
              return (
                <G key={`grid-${i}`}>
                  <Line
                    x1={0}
                    y1={y}
                    x2={plotWidth}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth="1"
                    strokeDasharray="4, 4"
                  />
                  <SvgText
                    x={plotWidth + 6}
                    y={y + 4}
                    fill={colors.textSecondary}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {formatPrice(lvl)}
                  </SvgText>
                </G>
              );
            })}

            {/* Candlesticks Layer */}
            {candles.map((c, idx) => {
              const slotWidth = plotWidth / candles.length;
              const candleWidth = Math.max(slotWidth * 0.72, 2.5);
              const candleX = idx * slotWidth + (slotWidth - candleWidth) / 2;
              const wickX = candleX + candleWidth / 2;

              const openPrice = isLkrMode ? (c.openLKR || c.open * usdToLkr) : c.open;
              const closePrice = isLkrMode ? (c.closeLKR || c.close * usdToLkr) : c.close;
              const highPrice = isLkrMode ? (c.highLKR || c.high * usdToLkr) : c.high;
              const lowPrice = isLkrMode ? (c.lowLKR || c.low * usdToLkr) : c.low;

              const isUp = closePrice >= openPrice;
              const candleColor = isUp ? colors.accent : colors.red;

              const yHigh = priceToY(highPrice);
              const yLow = priceToY(lowPrice);
              const yOpen = priceToY(openPrice);
              const yClose = priceToY(closePrice);

              const bodyY = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1.5);

              // Volume bar calculations
              const vHeight = volToHeight(c.volume);
              const vY = chartHeight - timeAxisHeight - vHeight;

              return (
                <G key={`candle-${idx}`}>
                  {/* Candle Wick */}
                  <Line
                    x1={wickX}
                    y1={yHigh}
                    x2={wickX}
                    y2={yLow}
                    stroke={candleColor}
                    strokeWidth="1.2"
                  />

                  {/* Candle Body */}
                  <Rect
                    x={candleX}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={candleColor}
                    rx={1}
                  />

                  {/* Volume Bar */}
                  {showVolume && (
                    <Rect
                      x={candleX}
                      y={vY}
                      width={candleWidth}
                      height={vHeight}
                      fill={candleColor}
                      opacity={0.45}
                      rx={1}
                    />
                  )}
                </G>
              );
            })}

            {/* Technical Indicator Lines */}
            {showSMA && smaPath !== '' && (
              <Path
                d={smaPath}
                fill="none"
                stroke="#FFA726"
                strokeWidth="1.8"
              />
            )}

            {showEMA && emaPath !== '' && (
              <Path
                d={emaPath}
                fill="none"
                stroke="#29B6F6"
                strokeWidth="1.8"
              />
            )}

            {/* Touch Crosshair Overlay */}
            {selectedIndex !== null && selectedIndex < candles.length && (
              <G>
                {(() => {
                  const slotWidth = plotWidth / candles.length;
                  const x = selectedIndex * slotWidth + slotWidth / 2;
                  const c = candles[selectedIndex];
                  const closeVal = isLkrMode ? (c.closeLKR || c.close * usdToLkr) : c.close;
                  const y = priceToY(closeVal);

                  return (
                    <>
                      {/* Vertical Time Line */}
                      <Line
                        x1={x}
                        y1={0}
                        x2={x}
                        y2={chartHeight - timeAxisHeight}
                        stroke="#FFF"
                        strokeWidth="1"
                        strokeDasharray="3, 3"
                        opacity={0.6}
                      />
                      {/* Horizontal Price Line */}
                      <Line
                        x1={0}
                        y1={y}
                        x2={plotWidth}
                        y2={y}
                        stroke="#FFF"
                        strokeWidth="1"
                        strokeDasharray="3, 3"
                        opacity={0.6}
                      />
                      {/* Crosshair Cursor Ring */}
                      <Rect
                        x={x - 4}
                        y={y - 4}
                        width={8}
                        height={8}
                        fill="#FFF"
                        rx={4}
                      />
                    </>
                  );
                })()}
              </G>
            )}

            {/* Time Axis Labels */}
            {candles.filter((_, i) => i % Math.max(Math.floor(candles.length / 5), 1) === 0).map((c, i) => {
              const slotWidth = plotWidth / candles.length;
              const origIdx = candles.indexOf(c);
              const x = origIdx * slotWidth + slotWidth / 2;
              return (
                <SvgText
                  key={`time-${i}`}
                  x={x}
                  y={chartHeight - 4}
                  fill={colors.textSecondary}
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {formatTime(c.timestamp)}
                </SvgText>
              );
            })}
          </Svg>
        )}
      </View>

      {/* Chart Footer Info Legend */}
      <View style={styles.chartFooterRow}>
        <View style={styles.legendLeft}>
          {showSMA && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFA726' }]} />
              <Text style={styles.legendText}>SMA(20)</Text>
            </View>
          )}
          {showEMA && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#29B6F6' }]} />
              <Text style={styles.legendText}>EMA(50)</Text>
            </View>
          )}
          {showVolume && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Volume</Text>
            </View>
          )}
        </View>
        <View style={styles.liveIndicatorContainer}>
          <View
            style={[
              styles.statusDot,
              connectionStatus === 'live'
                ? styles.statusDotLive
                : connectionStatus === 'stale'
                ? styles.statusDotStale
                : styles.statusDotDisconnected
            ]}
          />
          <Text
            style={[
              styles.liveIndicatorText,
              connectionStatus === 'live'
                ? styles.liveTextGreen
                : connectionStatus === 'stale'
                ? styles.liveTextAmber
                : styles.liveTextRed
            ]}
          >
            {connectionStatus === 'live'
              ? 'Binance Live'
              : connectionStatus === 'stale'
              ? 'Feed Stale'
              : 'Disconnected'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeframeRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    padding: 2,
  },
  timeframeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeframeBtnActive: {
    backgroundColor: colors.accentMuted,
  },
  timeframeText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timeframeTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  indicatorToggleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  toggleBtn: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnActive: {
    borderColor: colors.accent + '44',
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  hudRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
    gap: 8,
    justifyContent: 'space-between',
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hudLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  hudValue: {
    fontSize: 10,
    color: '#FFF',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  chartCanvasContainer: {
    height: 270,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  chartLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 10,
    fontSize: 11,
  },
  chartErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 20,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  retryBtnText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 11,
  },
  chartFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotLive: {
    backgroundColor: colors.accent,
  },
  statusDotStale: {
    backgroundColor: '#FFA726',
  },
  statusDotDisconnected: {
    backgroundColor: colors.red,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
  },
  liveTextGreen: {
    color: colors.accent,
  },
  liveTextAmber: {
    color: '#FFA726',
  },
  liveTextRed: {
    color: colors.red,
  },
});
