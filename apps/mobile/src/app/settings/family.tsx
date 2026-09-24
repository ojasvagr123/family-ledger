import { useMemo, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { updateFamilySettingsSchema } from '@family-ledger/contracts';
import { suggestedCurrencySymbol } from '@family-ledger/domain';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppField } from '@/components/ui/app-field';
import { AppButton } from '@/components/ui/app-button';
import { Choice } from '@/components/ui/choice';
import { Notice } from '@/components/ui/notice';
import { QueryFeedback } from '@/components/ui/query-feedback';
import { rpc } from '@/infrastructure/supabase/ledger';
import { useActiveFamily } from '@/providers/active-family-provider';

type FamilySettings = { id: string; name: string; currency_code: string; currency_symbol: string; timezone: string; fiscal_start_month: number; reporting_start_year: number; version: number };
type FamilyNotes = { notes: string; updated_by: string | null; updated_at: string | null; version: number };
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function SettingsForm({ settings }: { settings: FamilySettings }) {
  const client = useQueryClient(); const [name, setName] = useState(settings.name); const [currency, setCurrency] = useState(settings.currency_code); const [currencySymbol, setCurrencySymbol] = useState(settings.currency_symbol); const [timezone, setTimezone] = useState(settings.timezone); const [month, setMonth] = useState(String(settings.fiscal_start_month)); const [year, setYear] = useState(String(settings.reporting_start_year)); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const coverage = useMemo(() => { const startMonth = Number(month); const startYear = Number(year); if (!Number.isInteger(startMonth) || !Number.isInteger(startYear) || startMonth < 1 || startMonth > 12) return []; return [0,1,2].map((offset) => { const periodStartYear = startYear + offset; const labelYear = startMonth === 1 ? periodStartYear : periodStartYear + 1; const values = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(periodStartYear, startMonth - 1 + index, 1)).toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })); return { labelYear, values }; }); }, [month, year]);
  async function save() {
    if (busy) return; setError('');
    const parsed = updateFamilySettingsSchema.safeParse({ familyId: settings.id, expectedVersion: settings.version, name, currencyCode: currency.toUpperCase(), currencySymbol, timezone, fiscalStartMonth: Number(month), reportingStartYear: Number(year), idempotencyKey: Crypto.randomUUID() });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the settings.'); return; }
    setBusy(true);
    try { await rpc('update_family_settings', { p_family_id: parsed.data.familyId, p_expected_version: parsed.data.expectedVersion, p_name: parsed.data.name, p_currency_code: parsed.data.currencyCode, p_currency_symbol: parsed.data.currencySymbol, p_timezone: parsed.data.timezone, p_fiscal_start_month: parsed.data.fiscalStartMonth, p_reporting_start_year: parsed.data.reportingStartYear, p_idempotency_key: parsed.data.idempotencyKey }); await Promise.all([client.invalidateQueries({ queryKey: ['families'] }), client.invalidateQueries({ queryKey: ['family-settings', settings.id] }), client.invalidateQueries({ queryKey: ['annual-report', settings.id] }), client.invalidateQueries({ queryKey: ['report', settings.id] })]); }
    catch (cause) { setError(cause instanceof Error ? cause.message.replace('VERSION_CONFLICT', 'These settings changed on another device. Refresh before saving again.') : 'Unable to save family settings.'); }
    finally { setBusy(false); }
  }
  return <>{error && <Notice tone="danger" message={error} />}<Card><AppField label="Family name" value={name} onChangeText={setName} maxLength={100} /><AppField label="Currency code" value={currency} onChangeText={(value) => { const code = value.toUpperCase(); setCurrency(code); if (code.length === 3) setCurrencySymbol(suggestedCurrencySymbol(code)); }} maxLength={3} autoCapitalize="characters" /><AppField label="Currency symbol" value={currencySymbol} onChangeText={setCurrencySymbol} maxLength={8} /><AppField label="Timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" /><Choice label="Fiscal start month" value={month} onChange={setMonth} options={months.map((label, index) => ({ value: String(index + 1), label }))} /><AppField label="Reporting start year" value={year} onChangeText={setYear} keyboardType="number-pad" /><AppButton label="Save family settings" loading={busy} onPress={() => { void save(); }} /></Card><AppText variant="heading">Coverage preview</AppText>{coverage.map((period) => <Card key={period.labelYear}><AppText variant="heading">Reporting year {period.labelYear}</AppText><AppText>{period.values.join(' · ')}</AppText></Card>)}</>;
}

function NotesForm({ familyId, notes }: { familyId: string; notes: FamilyNotes }) {
  const client = useQueryClient(); const [value, setValue] = useState(notes.notes); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function save() { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await rpc('update_family_notes', { p_family_id: familyId, p_notes: value, p_expected_version: notes.version, p_idempotency_key: Crypto.randomUUID() }); await Promise.all([client.invalidateQueries({ queryKey: ['family-notes', familyId] }), client.invalidateQueries({ queryKey: ['family-settings', familyId] }), client.invalidateQueries({ queryKey: ['families'] })]); setMessage('Household notes saved.'); } catch (cause) { setError(cause instanceof Error ? cause.message.replace('VERSION_CONFLICT', 'Family details changed. Refresh and try again.') : 'Unable to save notes.'); } finally { setBusy(false); } }
  return <Card tone="accent"><AppText variant="heading">Household notes</AppText><AppText muted>Shared context for bills, savings goals or important financial reminders. Notes never affect calculations.</AppText>{message && <Notice message={message} />}{error && <Notice tone="danger" message={error} />}<AppField label="Shared notes" value={value} onChangeText={setValue} multiline maxLength={8000} placeholder="Example: School payment is due on the 10th…" /><AppButton label="Save household notes" loading={busy} onPress={() => { void save(); }} />{notes.updated_at && <AppText variant="caption" muted>Last updated {new Date(notes.updated_at).toLocaleString()}</AppText>}</Card>;
}

export default function FamilySettingsScreen() {
  const { activeFamily: family } = useActiveFamily();
  const query = useQuery({ queryKey: ['family-settings', family?.id], queryFn: () => rpc<FamilySettings>('get_family_settings', { p_family_id: family!.id }), enabled: !!family });
  const notes = useQuery({ queryKey: ['family-notes', family?.id], queryFn: () => rpc<FamilyNotes>('get_family_notes', { p_family_id: family!.id }), enabled: !!family });
  return <Screen title="Family settings" subtitle={family?.name}><QueryFeedback pending={query.isPending || notes.isPending} error={query.error || notes.error} retry={() => { void query.refetch(); void notes.refetch(); }} />{query.data && <SettingsForm key={query.data.version} settings={query.data} />}{family && notes.data && <NotesForm key={`${notes.data.version}-${notes.data.updated_at}`} familyId={family.id} notes={notes.data} />}<Notice message="Changing currency changes display formatting only. Existing stored amounts are not converted." /><AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
