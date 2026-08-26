function asResults(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function institutionName(record, fallback = '') {
  return (
    record.institution?.name ||
    record.connector?.name ||
    record.marketingName ||
    record.name ||
    fallback ||
    ''
  );
}

export async function buildFinancialSnapshot({ pluggy, items }) {
  const snapshotDate = new Date().toISOString();
  const accounts = [];
  const bills = [];
  const investments = [];
  const errors = [];

  for (const item of items) {
    try {
      const latestItem = await pluggy.fetchItem(item.id);
      const connectorName = institutionName(latestItem, item.connector);

      const accountPayload = await pluggy.fetchAccounts(item.id);
      for (const account of asResults(accountPayload)) {
        const accountRecord = {
          itemId: item.id,
          accountId: account.id,
          institution: institutionName(account, connectorName),
          name: account.name || account.marketingName || account.type || '',
          type: account.type || '',
          subtype: account.subtype || '',
          balance: Number(account.balance ?? account.bankData?.closingBalance ?? 0),
          currencyCode: account.currencyCode || 'BRL',
          updatedAt: account.updatedAt || latestItem.updatedAt || snapshotDate,
        };
        accounts.push(accountRecord);

        if (account.type === 'CREDIT' || account.subtype === 'CREDIT_CARD') {
          try {
            const billPayload = await pluggy.fetchBills(account.id);
            for (const bill of asResults(billPayload)) {
              bills.push({
                itemId: item.id,
                accountId: account.id,
                billId: bill.id,
                institution: accountRecord.institution,
                name: accountRecord.name,
                dueDate: bill.dueDate || '',
                billClosingDate: bill.billClosingDate || '',
                totalAmount: Number(bill.totalAmount ?? 0),
                minimumPaymentAmount: Number(bill.minimumPaymentAmount ?? 0),
                currencyCode: bill.totalAmountCurrencyCode || 'BRL',
              });
            }
          } catch (error) {
            errors.push({ itemId: item.id, scope: 'bills', message: error.message });
          }
        }
      }

      const investmentPayload = await pluggy.fetchInvestments(item.id);
      for (const investment of asResults(investmentPayload)) {
        investments.push({
          itemId: item.id,
          investmentId: investment.id,
          institution: investment.institution?.name || connectorName,
          name: investment.name || '',
          type: investment.type || '',
          subtype: investment.subtype || '',
          balance: Number(investment.balance ?? investment.amount ?? 0),
          amountOriginal: Number(investment.amountOriginal ?? 0),
          amountProfit: Number(investment.amountProfit ?? 0),
          currencyCode: investment.currencyCode || 'BRL',
          date: investment.date || '',
        });
      }
    } catch (error) {
      errors.push({ itemId: item.id, scope: 'item', message: error.message });
    }
  }

  const totals = {
    availableBalance: accounts
      .filter((account) => account.type !== 'CREDIT')
      .reduce((sum, account) => sum + account.balance, 0),
    creditCardBills: bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
    investments: investments.reduce((sum, investment) => sum + investment.balance, 0),
  };

  return {
    snapshotDate,
    totals: {
      ...totals,
      patrimonio: totals.availableBalance + totals.investments - totals.creditCardBills,
    },
    accounts,
    bills,
    investments,
    errors,
  };
}

export function snapshotToSheetRows(snapshot) {
  const rows = [
    ['data_snapshot', 'tipo', 'instituicao', 'nome', 'categoria', 'valor', 'moeda', 'referencia_id', 'vencimento'],
  ];

  for (const account of snapshot.accounts) {
    rows.push([
      snapshot.snapshotDate,
      'conta',
      account.institution,
      account.name,
      account.subtype || account.type,
      account.balance,
      account.currencyCode,
      account.accountId,
      '',
    ]);
  }

  for (const bill of snapshot.bills) {
    rows.push([
      snapshot.snapshotDate,
      'fatura',
      bill.institution,
      bill.name,
      'cartao_credito',
      bill.totalAmount,
      bill.currencyCode,
      bill.billId,
      bill.dueDate,
    ]);
  }

  for (const investment of snapshot.investments) {
    rows.push([
      snapshot.snapshotDate,
      'investimento',
      investment.institution,
      investment.name,
      investment.subtype || investment.type,
      investment.balance,
      investment.currencyCode,
      investment.investmentId,
      investment.date,
    ]);
  }

  return rows;
}

export function summaryToRows(snapshot) {
  return [
    ['indicador', 'valor', 'atualizado_em'],
    ['Dinheiro disponivel', snapshot.totals.availableBalance, snapshot.snapshotDate],
    ['Faturas em aberto', snapshot.totals.creditCardBills, snapshot.snapshotDate],
    ['Investimentos', snapshot.totals.investments, snapshot.snapshotDate],
    ['Patrimonio estimado', snapshot.totals.patrimonio, snapshot.snapshotDate],
  ];
}
