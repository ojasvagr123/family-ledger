import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { formatMoney } from '@family-ledger/domain';
import { Card } from './ui/card';
import { AppText } from './ui/app-text';
import { palette } from '@/constants/theme';

export type MoneyDatum = { label: string; valueMinor: string };
export type CategoryDatum = MoneyDatum & { percentage?: number | null };

const chartColors = ['#294C56', '#C26D58', '#5E94A3', '#D6A74B', '#75639A', '#5F8B66', '#A85D84', '#718096', '#A05A2C', '#2F855A', '#805AD5', '#B7791F', '#2B6CB0', '#C53030', '#4A5568', '#6B8E23', '#8B5CF6', '#0F766E', '#BE123C', '#0369A1'];

function absolute(value: bigint) { return value < 0n ? -value : value; }
function boundedRatio(numerator: bigint, denominator: bigint, scale = 10_000) {
  if (denominator === 0n) return 0;
  return Number((numerator * BigInt(scale)) / denominator) / scale;
}
function percent(value: bigint, maximum: bigint) { return Math.max(0, Math.min(100, boundedRatio(absolute(value), absolute(maximum), 10_000) * 100)); }
function moneySummary(items: MoneyDatum[], currency: string, currencySymbol?: string) { return items.map((item) => `${item.label}: ${formatMoney(item.valueMinor, currency, currencySymbol)}`).join('. '); }

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function piePath(cx: number, cy: number, radius: number, start: number, end: number) {
  const from = polarPoint(cx, cy, radius, end); const to = polarPoint(cx, cy, radius, start); const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 0 ${to.x} ${to.y} Z`;
}

export function ComparisonBarChart({ title, incomeMinor, expenseMinor, currency, currencySymbol }: { title: string; incomeMinor: string; expenseMinor: string; currency: string; currencySymbol?: string }) {
  const income = BigInt(incomeMinor); const expense = BigInt(expenseMinor); const maximum = income > expense ? income : expense;
  const items = [{ label: 'Income', valueMinor: incomeMinor }, { label: 'Expenses', valueMinor: expenseMinor }];
  return <Card><AppText variant="heading">{title}</AppText><View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${moneySummary(items, currency, currencySymbol)}`}>
    {items.map((item, index) => <View key={item.label} style={{ gap: 4, marginTop: 10 }}><AppText>{item.label} · {formatMoney(item.valueMinor, currency, currencySymbol)}</AppText><View style={{ height: 22, borderRadius: 6, backgroundColor: palette.surfaceMuted, overflow: 'hidden' }}><View style={{ width: `${maximum === 0n ? 0 : percent(BigInt(item.valueMinor), maximum)}%`, height: 22, backgroundColor: index === 0 ? palette.incomeStrong : palette.expenseStrong }} /></View></View>)}
  </View></Card>;
}

export function RatioDoughnutChart({ title, percentage, centerLabel }: { title: string; percentage: number | null; centerLabel?: string }) {
  const safe = percentage === null ? 0 : Math.max(0, Math.min(100, percentage)); const overflow = percentage === null ? 0 : Math.max(0, Math.min(100, percentage - 100)); const circumference = 2 * Math.PI * 62; const overflowCircumference = 2 * Math.PI * 79; const filled = circumference * safe / 100; const overflowFilled = overflowCircumference * overflow / 100;
  return <Card><AppText variant="heading">{title}</AppText><View accessible accessibilityRole="image" accessibilityLabel={`${title}: ${percentage === null ? 'unavailable because income is zero' : `${percentage}%`}`} style={{ alignItems: 'center' }}>
    <Svg width={190} height={190} viewBox="0 0 190 190" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx="95" cy="95" r="62" fill="none" stroke={palette.surfaceMuted} strokeWidth="24" />
      <Circle cx="95" cy="95" r="62" fill="none" stroke={safe <= 100 ? palette.expenseStrong : palette.destructive} strokeWidth="24" strokeLinecap="round" strokeDasharray={`${filled} ${circumference - filled}`} transform="rotate(-90 95 95)" />
      {overflow > 0 && <Circle cx="95" cy="95" r="79" fill="none" stroke={palette.destructive} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${overflowFilled} ${overflowCircumference - overflowFilled}`} transform="rotate(-90 95 95)" />}
      <SvgText x="95" y="91" textAnchor="middle" fontSize="24" fontWeight="700" fill={palette.text}>{percentage === null ? '—' : `${percentage}%`}</SvgText>
      <SvgText x="95" y="116" textAnchor="middle" fontSize="12" fill={palette.textMuted}>{centerLabel ?? 'of income'}</SvgText>
    </Svg>
  </View></Card>;
}

export function DistributionDoughnutChart({ title, items, currency, currencySymbol, variant = 'doughnut' }: { title: string; items: CategoryDatum[]; currency: string; currencySymbol?: string; variant?: 'doughnut' | 'pie' }) {
  const slices = items.filter((item) => BigInt(item.valueMinor) > 0n); const total = slices.reduce((sum, item) => sum + BigInt(item.valueMinor), 0n);
  const circumference = 2 * Math.PI * 64; const segments = slices.map((item, index) => { const ratio = boundedRatio(BigInt(item.valueMinor), total, 100_000); const length = circumference * ratio; const precedingRatio = slices.slice(0, index).reduce((sum, previous) => sum + boundedRatio(BigInt(previous.valueMinor), total, 100_000), 0); return { ...item, length, dashOffset: -circumference * precedingRatio, startAngle: precedingRatio * 360, endAngle: (precedingRatio + ratio) * 360 }; });
  return <Card><AppText variant="heading">{title}</AppText>{total === 0n ? <AppText muted>No values in this period.</AppText> : <><View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${moneySummary(slices, currency, currencySymbol)}`} style={{ alignItems: 'center' }}>
    <Svg width={190} height={190} viewBox="0 0 190 190" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {variant === 'doughnut' && <Circle cx="95" cy="95" r="64" fill="none" stroke={palette.surfaceMuted} strokeWidth="28" />}
      {variant === 'doughnut' ? segments.map((item, index) => <Circle key={`${item.label}-${index}`} cx="95" cy="95" r="64" fill="none" stroke={chartColors[index % chartColors.length]} strokeWidth="28" strokeDasharray={`${item.length} ${circumference - item.length}`} strokeDashoffset={item.dashOffset} transform="rotate(-90 95 95)" />) : segments.length === 1 ? <Circle cx="95" cy="95" r="78" fill={chartColors[0]} /> : segments.map((item, index) => <Path key={`${item.label}-${index}`} d={piePath(95, 95, 78, item.startAngle, item.endAngle)} fill={chartColors[index % chartColors.length]} stroke={palette.surface} strokeWidth="1" />)}
      {variant === 'doughnut' && <><SvgText x="95" y="83" textAnchor="middle" fontSize="12" fill={palette.textMuted}>Total</SvgText><SvgText x="95" y="108" textAnchor="middle" fontSize="20" fontWeight="700" fill={palette.text}>{slices.length}</SvgText><SvgText x="95" y="129" textAnchor="middle" fontSize="11" fill={palette.textMuted}>{slices.length === 1 ? 'category' : 'categories'}</SvgText></>}
    </Svg>
  </View><View style={{ gap: 8 }}>{slices.map((item, index) => <View key={`${item.label}-legend`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: chartColors[index % chartColors.length] }} /><AppText style={{ flex: 1 }}>{item.label}</AppText><AppText>{formatMoney(item.valueMinor, currency, currencySymbol)}</AppText></View>)}</View></>}</Card>;
}

export function AreaTrendChart({ title, items, currency, currencySymbol }: { title: string; items: MoneyDatum[]; currency: string; currencySymbol?: string }) {
  const width = 340; const height = 170; const padding = 24; const values = items.map((item) => BigInt(item.valueMinor)); const minimum = values.reduce((min, value) => value < min ? value : min, 0n); const maximum = values.reduce((max, value) => value > max ? value : max, 0n); const span = maximum - minimum || 1n;
  const points = values.map((value, index) => { const x = padding + (items.length <= 1 ? 0 : index * (width - padding * 2) / (items.length - 1)); const y = height - padding - boundedRatio(value - minimum, span, 100_000) * (height - padding * 2); return { x, y }; });
  const line = points.map((point) => `${point.x},${point.y}`).join(' '); const area = points.length ? `${padding},${height - padding} ${line} ${points.at(-1)!.x},${height - padding}` : '';
  return <Card><AppText variant="heading">{title}</AppText><View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${moneySummary(items, currency, currencySymbol)}`}>
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={palette.border} />
      {area && <Polygon points={area} fill={palette.income} />}
      {line && <Polyline points={line} fill="none" stroke={palette.incomeStrong} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((point, index) => <Circle key={items[index].label} cx={point.x} cy={point.y} r="4" fill={palette.action} />)}
    </Svg>
  </View><View style={{ gap: 5 }}>{items.map((item) => <AppText key={item.label} variant="caption" muted>{item.label}: {formatMoney(item.valueMinor, currency, currencySymbol)}</AppText>)}</View></Card>;
}

export function MonthlyComboChart({ title, months, currency, currencySymbol }: { title: string; months: { label: string; income_minor: string; expense_minor: string; net_minor: string }[]; currency: string; currencySymbol?: string }) {
  const width = 360; const height = 220; const top = 16; const bottom = 42; const left = 18; const values = months.flatMap((month) => [BigInt(month.income_minor), BigInt(month.expense_minor), BigInt(month.net_minor)]); const minimum = values.reduce((min, value) => value < min ? value : min, 0n); const maximum = values.reduce((max, value) => value > max ? value : max, 0n); const span = maximum - minimum || 1n; const plotHeight = height - top - bottom; const group = (width - left * 2) / Math.max(1, months.length); const y = (value: bigint) => top + (1 - boundedRatio(value - minimum, span, 100_000)) * plotHeight; const zeroY = y(0n); const netPoints = months.map((month, index) => `${left + group * index + group / 2},${y(BigInt(month.net_minor))}`).join(' ');
  return <Card><AppText variant="heading">{title}</AppText><View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${months.map((month) => `${month.label}: income ${formatMoney(month.income_minor, currency, currencySymbol)}, expenses ${formatMoney(month.expense_minor, currency, currencySymbol)}, net ${formatMoney(month.net_minor, currency, currencySymbol)}`).join('. ')}`}>
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={left} y1={zeroY} x2={width - left} y2={zeroY} stroke={palette.border} />
      {months.map((month, index) => { const x = left + group * index; const incomeY = y(BigInt(month.income_minor)); const expenseY = y(BigInt(month.expense_minor)); return <G key={month.label}><Rect x={x + group * .12} y={incomeY} width={Math.max(3, group * .28)} height={Math.max(0, zeroY - incomeY)} fill={palette.incomeStrong} /><Rect x={x + group * .48} y={expenseY} width={Math.max(3, group * .28)} height={Math.max(0, zeroY - expenseY)} fill={palette.expenseStrong} /><SvgText x={x + group / 2} y={height - 18} textAnchor="middle" fontSize="8" fill={palette.textMuted}>{month.label.split(' ')[0]}</SvgText></G>; })}
      {netPoints && <Polyline points={netPoints} fill="none" stroke={palette.action} strokeWidth="3" />}
    </Svg>
  </View><AppText variant="caption" muted>Income bars · Expense bars · Net-savings line</AppText></Card>;
}

export function TrendBarChart({ title, items, currency, currencySymbol }: { title: string; items: MoneyDatum[]; currency: string; currencySymbol?: string }) {
  const width = 360; const height = 200; const top = 16; const bottom = 42; const left = 18; const values = items.map((item) => BigInt(item.valueMinor)); const minimum = values.reduce((min, value) => value < min ? value : min, 0n); const maximum = values.reduce((max, value) => value > max ? value : max, 0n); const span = maximum - minimum || 1n; const group = (width - left * 2) / Math.max(1, items.length); const y = (value: bigint) => top + (1 - boundedRatio(value - minimum, span, 100_000)) * (height - top - bottom); const zeroY = y(0n);
  return <Card><AppText variant="heading">{title}</AppText><View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${moneySummary(items, currency, currencySymbol)}`}>
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={left} y1={zeroY} x2={width - left} y2={zeroY} stroke={palette.border} />
      {items.map((item, index) => { const value = BigInt(item.valueMinor); const valueY = y(value); const x = left + group * index + group * .2; return <G key={item.label}><Rect x={x} y={value >= 0n ? valueY : zeroY} width={Math.max(4, group * .6)} height={Math.abs(zeroY - valueY)} fill={value >= 0n ? palette.incomeStrong : palette.expenseStrong} /><SvgText x={left + group * index + group / 2} y={height - 18} textAnchor="middle" fontSize="8" fill={palette.textMuted}>{item.label.split(' ')[0]}</SvgText></G>; })}
    </Svg>
  </View><View style={{ gap: 5 }}>{items.map((item) => <AppText key={item.label} variant="caption" muted>{item.label}: {formatMoney(item.valueMinor, currency, currencySymbol)}</AppText>)}</View></Card>;
}

export function HorizontalRankingChart({ title, items, currency, currencySymbol, limit = 20 }: { title: string; items: CategoryDatum[]; currency: string; currencySymbol?: string; limit?: number }) {
  const visible = items.filter((item) => BigInt(item.valueMinor) !== 0n).slice(0, limit); const maximum = visible.reduce((max, item) => { const value = absolute(BigInt(item.valueMinor)); return value > max ? value : max; }, 0n);
  return <Card><AppText variant="heading">{title}</AppText>{visible.length === 0 && <AppText muted>No category values in this period.</AppText>}{visible.map((item, index) => <View key={`${item.label}-${index}`} accessible accessibilityLabel={`${index + 1}. ${item.label}, ${formatMoney(item.valueMinor, currency, currencySymbol)}, ${item.percentage ?? 0}%`} style={{ gap: 4, marginTop: 10 }}><AppText>{index + 1}. {item.label}</AppText><AppText variant="caption" muted>{formatMoney(item.valueMinor, currency, currencySymbol)} · {item.percentage ?? 0}%</AppText><View style={{ height: 8, borderRadius: 4, backgroundColor: palette.surfaceMuted, overflow: 'hidden' }}><View style={{ width: `${maximum === 0n ? 0 : percent(BigInt(item.valueMinor), maximum)}%`, height: 8, backgroundColor: title.toLowerCase().includes('expense') ? palette.expenseStrong : palette.incomeStrong }} /></View></View>)}</Card>;
}
