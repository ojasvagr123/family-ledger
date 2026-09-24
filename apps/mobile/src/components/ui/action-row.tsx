import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './app-text';
import { palette, radius, spacing } from '@/constants/theme';

export function ActionRow({ title, detail, symbol, onPress, destructive }: { title: string; detail?: string; symbol?: string; onPress: () => void; destructive?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={[styles.symbol, destructive && styles.destructiveSymbol]}><AppText style={destructive ? styles.destructiveText : styles.symbolText}>{symbol ?? '›'}</AppText></View><View style={styles.copy}><AppText style={[styles.title, destructive && styles.destructiveText]}>{title}</AppText>{detail && <AppText variant="caption" muted>{detail}</AppText>}</View><AppText muted style={styles.chevron}>›</AppText></Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 68, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border },
  pressed: { backgroundColor: palette.surfaceMuted }, symbol: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.actionSoft },
  destructiveSymbol: { backgroundColor: palette.danger }, symbolText: { color: palette.action, fontWeight: '800', fontSize: 17 }, destructiveText: { color: palette.destructive },
  copy: { flex: 1, gap: 2 }, title: { fontWeight: '700' }, chevron: { fontSize: 24 },
});
