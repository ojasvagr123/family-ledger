import { router } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/app-text';
import { AppButton } from '@/components/ui/app-button';

export default function HelpScreen() {
  return <Screen title="Help & FAQs" subtitle="FamilyLedger guide">
    <Card><AppText variant="heading">Getting started</AppText><AppText>Choose or create a family, create at least one account, then add income, expenses or a balance adjustment. Owners approve invitation requests before members can view financial data.</AppText></Card>
    <Card><AppText variant="heading">Reports</AppText><AppText>Monthly reports let you choose any month and year. Annual reports use the family fiscal start month and label a fiscal year by the calendar year in which it ends. Custom reports accept any inclusive start and end date and include quick daily, weekly, monthly, quarterly, six-month and fiscal-year periods.</AppText></Card>
    <Card><AppText variant="heading">Balance adjustments</AppText><AppText>Use a positive adjustment to increase an account balance and a negative adjustment to decrease it. Adjustments change account balances but are excluded from income and expense totals.</AppText></Card>
    <Card><AppText variant="heading">Reconciliation</AppText><AppText>Enter the actual bank or wallet balance and checked date on Accounts. Difference is calculated against the ledger balance so discrepancies can be investigated.</AppText></Card>
    <Card><AppText variant="heading">Activity filters</AppText><AppText>Search descriptions, remarks, categories and accounts. Filter by dates, transaction type, account, category or creator. Sort by date, amount, category or account.</AppText></Card>
    <Card><AppText variant="heading">CSV import</AppText><AppText>Open More, then Import CSV. Choose a bank CSV file or paste its contents, map the source columns, choose the date order and select default account/category values when the file does not contain them. Review invalid rows before importing.</AppText></Card>
    <Card><AppText variant="heading">FAQs</AppText><AppText>Why can’t I edit? Viewers are read-only; members can edit their own transactions; Owners and Admins can manage family data.</AppText><AppText>Why is a ratio unavailable? Savings and expense-to-income ratios require non-zero income.</AppText><AppText>Can I undo a deleted transaction? Open More, then Transaction trash. Owners and Admins can restore any transaction; Members can restore transactions they created.</AppText><AppText>How do I correct an account balance? Reconcile the account to record the actual balance, then add a positive or negative balance adjustment when the ledger needs correction.</AppText></Card>
    <AppButton label="Back" kind="secondary" onPress={() => router.back()} />
  </Screen>;
}
