import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, localToday } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { MonthlySummary } from '@/components/monthly-summary';
import { monthlyReport } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';
import { palette } from '@/constants/theme';
export default function ReportsScreen() {
  const { activeFamily: family } = useActiveFamily(); const [selection, setSelection] = useState<{ familyId: string | null; offset: number }>({ familyId: null, offset: 0 });
  const offset = selection.familyId === family?.id ? selection.offset : 0;
  const [familyYear, familyMonth] = localToday(family?.timezone).split('-').map(Number);
  const period = new Date(familyYear, familyMonth - 1 + offset, 1); const year = period.getFullYear(); const month = period.getMonth() + 1;
  const query = useQuery({ queryKey: ['report', family?.id, year, month], queryFn: () => monthlyReport(family!.id, year, month), enabled: !!family, refetchInterval: 15_000 });
  return <Screen title="Monthly report" subtitle={family?.name}><AppText variant="heading">{period.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</AppText><View style={{ flexDirection: 'row', gap: 8 }}><AppButton label="Previous" kind="secondary" disabled={year === 1900 && month === 1} onPress={() => setSelection({ familyId: family?.id ?? null, offset: offset - 1 })} /><AppButton label="Next" kind="secondary" disabled={year === 2200 && month === 12} onPress={() => setSelection({ familyId: family?.id ?? null, offset: offset + 1 })} /></View><QueryFeedback pending={query.isPending} error={query.error} retry={query.refetch} />{query.data && !query.error && <><MonthlySummary report={query.data} currency={family?.currency_code ?? 'INR'} /><AppText variant="heading">Categories, highest first</AppText>{query.data.categories.length === 0 && <AppText muted>No income or expenses in this month.</AppText>}{query.data.categories.map((category) => <Card key={category.id}><AppText variant="heading">{category.name}</AppText><AppText>{category.type} · {formatMoney(category.total_minor, family?.currency_code)} · {category.percentage}%</AppText><View accessible={false} style={{ height: 10, backgroundColor: palette.border, borderRadius: 5 }}><View style={{ width: `${Math.min(100, category.percentage)}%`, height: 10, backgroundColor: category.type === 'INCOME' ? palette.action : palette.destructive, borderRadius: 5 }} /></View></Card>)}</>}<AppButton label="Refresh report" kind="secondary" onPress={() => { void query.refetch(); }} /></Screen>;
}
