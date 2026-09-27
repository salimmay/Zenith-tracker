import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { STATUS_LABEL } from '@/lib/format';
import type { Stats, StatsRange, Status } from '@/lib/types';
import { colors, radius, space } from '@/theme';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

/** Small headline number — a stat tile, not a chart. */
export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const RANGE_LABEL: Record<StatsRange, string> = { month: 'This month', year: 'This year', all: 'All time' };

function breakdown(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.round(minutes % 60);
  const parts: [number, string][] = [
    [days, days === 1 ? 'day' : 'days'],
    [hours, hours === 1 ? 'hour' : 'hours'],
    [mins, mins === 1 ? 'minute' : 'minutes'],
  ];
  return parts.filter(([n]) => n > 0);
}

/** The hero number: minutes watched in the selected range, then in human terms. */
export function HeroTime({ minutes, range }: { minutes: number; range: StatsRange }) {
  const parts = breakdown(minutes);
  return (
    <LinearGradient colors={[colors.tealDeep, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Text variant="micro" tone="muted">
        {RANGE_LABEL[range]}
      </Text>
      <View style={styles.heroNumber} accessible accessibilityLabel={`${Math.round(minutes)} minutes`}>
        <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
          {Math.round(minutes).toLocaleString()}
        </Text>
        <Text variant="title" tone="muted">
          min
        </Text>
      </View>
      <Text tone="muted" style={{ fontSize: 16, lineHeight: 23 }}>
        {minutes === 0 ? (
          'Nothing watched yet in this period.'
        ) : (
          <>
            in front of the screen. That's{' '}
            {parts.map(([n, unit], i) => (
              <Text key={unit} tone="muted" style={{ fontSize: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                  {n} {unit}
                </Text>
                {i < parts.length - 2 ? ', ' : i === parts.length - 2 ? ' and ' : ''}
              </Text>
            ))}
            .
          </>
        )}
      </Text>
    </LinearGradient>
  );
}

const CHART_H = 150;
const PAD_TOP = 26; // room for value labels above points
const PAD_BOTTOM = 8;

function hoursLabel(minutes: number) {
  const h = minutes / 60;
  return h >= 10 || h === 0 ? `${Math.round(h)}h` : `${h.toFixed(1).replace(/\.0$/, '')}h`;
}

/**
 * Hours watched per month, last 12 months. Single series — the heading names
 * it, so no legend. Labels sit on the peak and the selected point only (never
 * a number on every point); tap any month to read it.
 */
export function MonthlyChart({ monthly }: { monthly: Stats['monthly'] }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { key, date: d, minutes: monthly.find((m) => m.month === key)?.minutes ?? 0 };
    });
  }, [monthly]);

  const max = Math.max(60, ...months.map((m) => m.minutes));
  const peak = months.reduce((best, m, i) => (m.minutes > months[best].minutes ? i : best), 0);
  const step = width / months.length;
  const x = (i: number) => step * i + step / 2;
  const y = (m: number) => PAD_TOP + (1 - m / max) * (CHART_H - PAD_TOP - PAD_BOTTOM);

  const line = months.map((m, i) => `${i ? 'L' : 'M'}${x(i)},${y(m.minutes)}`).join(' ');
  const area = `${line} L${x(months.length - 1)},${CHART_H} L${x(0)},${CHART_H} Z`;
  const labelled = new Set([peak, months.length - 1, ...(selected !== null ? [selected] : [])]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="image" accessibilityLabel={`Hours watched per month, peak ${hoursLabel(months[peak].minutes)}`}>
      {width > 0 && (
        <View>
          <Svg width={width} height={CHART_H}>
            <Defs>
              <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.teal} stopOpacity={0.35} />
                <Stop offset="1" stopColor={colors.teal} stopOpacity={0} />
              </SvgGradient>
            </Defs>
            <Line x1={0} x2={width} y1={CHART_H - PAD_BOTTOM} y2={CHART_H - PAD_BOTTOM} stroke={colors.border} strokeWidth={1} />
            <Path d={area} fill="url(#area)" />
            <Path d={line} stroke={colors.teal} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {months.map((m, i) => (
              <Circle
                key={m.key}
                cx={x(i)}
                cy={y(m.minutes)}
                r={selected === i ? 6 : 4}
                fill={colors.teal}
                stroke={colors.background}
                strokeWidth={2}
              />
            ))}
          </Svg>
          {/* Value labels as text (not SVG) so they use the app's type and scale with it. */}
          {months.map((m, i) =>
            labelled.has(i) ? (
              <Text
                key={m.key}
                variant="caption"
                style={[styles.pointLabel, { left: x(i) - 30, top: y(m.minutes) - 24, color: selected === i ? colors.teal : colors.text }]}
              >
                {hoursLabel(m.minutes)}
              </Text>
            ) : null
          )}
          {/* Hit targets wider than the marks: one column per month. */}
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              {months.map((m, i) => (
                <Pressable
                  key={m.key}
                  style={{ flex: 1 }}
                  onPress={() => setSelected(selected === i ? null : i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${hoursLabel(m.minutes)}`}
                />
              ))}
            </View>
          </View>
        </View>
      )}
      <View style={styles.axis}>
        {months.map((m, i) => (
          <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="caption" tone={selected === i ? 'teal' : 'faint'} style={{ fontSize: 11 }}>
              {m.date.toLocaleDateString(undefined, { month: 'narrow' })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const ORDER: Status[] = ['watching', 'waiting', 'plan_to_watch', 'completed', 'paused', 'dropped'];

/**
 * Status breakdown as labelled rows with a one-hue magnitude bar each. Six
 * statuses in a stacked bar would need six colours to tell apart; rows need
 * none and read exactly.
 */
export function StatusBreakdown({ statuses }: { statuses: Stats['statuses'] }) {
  const rows = ORDER.filter((s) => statuses[s]);
  const max = Math.max(1, ...rows.map((s) => statuses[s] ?? 0));
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      {rows.map((s) => (
        <View key={s} style={styles.statusRow} accessible accessibilityLabel={`${STATUS_LABEL[s]}: ${statuses[s]}`}>
          <Text variant="caption" tone="muted" style={styles.statusLabel}>
            {STATUS_LABEL[s]}
          </Text>
          <ProgressBar value={(statuses[s] ?? 0) / max} height={6} style={{ flex: 1 }} />
          <Text variant="caption" style={styles.statusValue}>
            {statuses[s]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 2,
  },
  hero: {
    padding: space.xl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,203,196,0.25)',
    gap: space.sm,
  },
  heroNumber: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  heroValue: { fontSize: 64, lineHeight: 72, fontWeight: '800', letterSpacing: -2, color: colors.text, flexShrink: 1 },
  pointLabel: { position: 'absolute', width: 60, textAlign: 'center', fontWeight: '700' },
  axis: { flexDirection: 'row', marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusLabel: { width: 96 },
  statusValue: { width: 32, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
