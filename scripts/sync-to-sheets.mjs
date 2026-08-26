import { loadEnv } from '../src/env.mjs';
import { Store } from '../src/store.mjs';
import { PluggyClient } from '../src/pluggy.mjs';
import { buildFinancialSnapshot, snapshotToSheetRows, summaryToRows } from '../src/normalize.mjs';
import { replaceTabRows } from '../src/google-sheets.mjs';

loadEnv();

const store = new Store();
const pluggy = new PluggyClient();
const items = await store.listItems();

if (items.length === 0) {
  console.log('Nenhum item conectado ainda. Abra o painel local e conecte um banco primeiro.');
  process.exit(0);
}

const snapshot = await buildFinancialSnapshot({ pluggy, items });
await store.saveSnapshot(snapshot);

await replaceTabRows(process.env.SHEET_RAW_TAB || 'DadosPluggy', snapshotToSheetRows(snapshot));
await replaceTabRows(process.env.SHEET_SUMMARY_TAB || 'ResumoAutomatizado', summaryToRows(snapshot));

console.log(`Sincronizado com sucesso: ${items.length} conexao(oes), ${snapshot.accounts.length} conta(s), ${snapshot.bills.length} fatura(s), ${snapshot.investments.length} investimento(s).`);
