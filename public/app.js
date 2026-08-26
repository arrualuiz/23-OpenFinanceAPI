const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const logEl = document.querySelector('#log');

function log(message, data) {
  const line = `[${new Date().toLocaleTimeString('pt-BR')}] ${message}`;
  logEl.textContent = `${line}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}\n\n${logEl.textContent}`;
}

function explainPluggyError(error) {
  const payload = typeof error === 'string' ? error : JSON.stringify(error || {});
  if (payload.includes('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED')) {
    return 'Sua aplicacao Pluggy ainda esta em modo demo/trial. Nesse modo, contas reais como Santander nao conectam; use Pluggy Bank sandbox para testar ou solicite acesso a dados reais no dashboard da Pluggy.';
  }
  return 'Pluggy Connect retornou erro.';
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

async function refreshHealth() {
  const health = await api('/api/health');
  document.querySelector('#pluggyStatus').textContent = health.hasPluggyKeys ? 'configurada' : 'faltam chaves';
  document.querySelector('#sheetsStatus').textContent = health.hasGoogleSheetsConfig
    ? 'configurada'
    : 'opcional/pendente';
}

async function refreshItems() {
  const { items } = await api('/api/items');
  document.querySelector('#itemCount').textContent = String(items.length);
  const container = document.querySelector('#items');
  container.innerHTML = '';

  if (items.length === 0) {
    container.textContent = 'Nenhum banco conectado ainda.';
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item';
    card.innerHTML = `
      <div>
        <strong>${item.connector || 'Banco conectado'}</strong>
        <code>${item.id}</code>
      </div>
      <button class="secondary" data-update="${item.id}">Atualizar conexao</button>
    `;
    container.appendChild(card);
  }

  container.querySelectorAll('[data-update]').forEach((button) => {
    button.addEventListener('click', () => openPluggyConnect(button.dataset.update));
  });
}

function renderSnapshot(snapshot) {
  if (!snapshot) return;
  document.querySelector('#snapshotDate').textContent = new Date(snapshot.snapshotDate).toLocaleString('pt-BR');
  document.querySelector('#availableBalance').textContent = money.format(snapshot.totals.availableBalance);
  document.querySelector('#investments').textContent = money.format(snapshot.totals.investments);
  document.querySelector('#bills').textContent = money.format(snapshot.totals.creditCardBills);
  document.querySelector('#patrimonio').textContent = money.format(snapshot.totals.patrimonio);
}

async function refreshSnapshot() {
  const { snapshot } = await api('/api/snapshot');
  renderSnapshot(snapshot);
}

async function openPluggyConnect(itemId) {
  try {
    const token = await api('/api/pluggy/connect-token', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });

    if (!window.PluggyConnect) {
      throw new Error('Script do Pluggy Connect nao carregou. Confira sua internet.');
    }

    const widget = new PluggyConnect({
      connectToken: token.accessToken,
      includeSandbox: true,
      updateItem: itemId || undefined,
      onSuccess: async ({ item }) => {
        log('Conexao Pluggy criada/atualizada.', item);
        await api('/api/pluggy/items', {
          method: 'POST',
          body: JSON.stringify({ item }),
        });
        await refreshItems();
      },
      onError: (error) => {
        log(explainPluggyError(error), error);
      },
      onClose: () => log('Pluggy Connect fechado.'),
    });

    widget.init();
  } catch (error) {
    log(`Erro ao abrir Pluggy Connect: ${error.message}`);
  }
}

async function syncNow() {
  try {
    log('Sincronizando saldos, faturas e investimentos...');
    const snapshot = await api('/api/sync', { method: 'POST' });
    renderSnapshot(snapshot);
    log('Sincronizacao concluida.', {
      contas: snapshot.accounts.length,
      faturas: snapshot.bills.length,
      investimentos: snapshot.investments.length,
      erros: snapshot.errors,
    });
  } catch (error) {
    log(`Erro na sincronizacao: ${error.message}`);
  }
}

document.querySelector('#connectButton').addEventListener('click', () => openPluggyConnect());
document.querySelector('#syncButton').addEventListener('click', syncNow);

refreshHealth().catch((error) => log(error.message));
refreshItems().catch((error) => log(error.message));
refreshSnapshot().catch((error) => log(error.message));
