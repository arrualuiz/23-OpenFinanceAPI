# Finance Automation

Automacao para substituir o preenchimento manual do seu Google Forms por:

1. Pluggy Connect para autorizar bancos.
2. Backend local para guardar os `itemId` das conexoes.
3. Sincronizacao de saldos, faturas e investimentos.
4. Exportacao opcional para Google Sheets.

## 1. Abrir no VS Code

No terminal:

```powershell
cd C:\Users\arruadev\Documents\Codex\2026-08-19\https-www-pluggy-ai-https-www\work\finance-automation
code .
```

Se o comando `code` nao existir, abra o VS Code e use `File > Open Folder...` nessa pasta.

## 2. Configurar a Pluggy

1. Crie/acesse sua conta em `https://dashboard.pluggy.ai`.
2. Crie uma Application.
3. Copie `CLIENT_ID` e `CLIENT_SECRET`.
4. Duplique `.env.example` para `.env`.
5. Preencha:

```env
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
```

Nunca coloque essas chaves no frontend, GitHub ou Google Sheets.

## 3. Rodar localmente

```powershell
node --version
node server.mjs
```

Abra:

```text
http://localhost:3333
```

Clique em `Conectar banco`. No inicio, use sandbox se quiser testar. Para banco real, prefira conectores Open Finance quando estiverem disponiveis no seu plano.

Se aparecer `TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED`, sua aplicacao ainda esta em modo demo/trial. Nesse modo a Pluggy so permite conectar contas de teste, como `Pluggy Bank`. Para conectar Santander, Nubank, C6, Neon ou Mercado Pago reais, solicite acesso a dados reais/producao no dashboard da Pluggy.

## 4. Sincronizar

Depois de conectar pelo menos um banco:

1. Clique `Sincronizar agora` no painel; ou
2. Rode no terminal:

```powershell
npm run sync
```

O painel salva um snapshot local em `data/finance-store.json`.

## 5. Google Sheets

Para escrever na sua planilha:

1. Crie uma service account no Google Cloud.
2. Baixe a chave JSON.
3. Compartilhe sua planilha com o email da service account.
4. Preencha no `.env`:

```env
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Rode:

```powershell
npm run sync
```

O script cria/atualiza duas abas:

- `DadosPluggy`: linhas normalizadas de contas, faturas e investimentos.
- `ResumoAutomatizado`: totais para alimentar seu painel atual.

## Observacoes de seguranca

- Comece com leitura de dados, sem pagamentos.
- Prefira Open Finance oficial.
- Nao grave senha bancaria em codigo, planilha ou arquivo.
- Revogue consentimentos que voce nao usa mais pelo app do banco.
- O arquivo `data/finance-store.json` fica fora do Git via `.gitignore`.
