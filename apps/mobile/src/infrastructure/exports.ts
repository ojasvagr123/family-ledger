import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function toCsv(headers: string[], rows: unknown[][]) { return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`; }

export async function shareCsv(filename: string, csv: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-'); const file = new File(Paths.cache, safeName);
  if (file.exists) file.delete(); file.create({ intermediates: true }); file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share FamilyLedger export', UTI: 'public.comma-separated-values-text' });
}
