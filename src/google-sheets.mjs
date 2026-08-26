import crypto from 'node:crypto';
import { requireEnv } from './env.mjs';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function getAccessToken() {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = requireEnv('GOOGLE_PRIVATE_KEY');
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );

  const unsigned = `${header}.${claim}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google OAuth falhou (${response.status}): ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function encodeRange(tabName) {
  return encodeURIComponent(`'${tabName}'!A1`);
}

async function sheetsFetch(pathname, options = {}) {
  const sheetId = requireEnv('GOOGLE_SHEET_ID');
  const token = await getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${pathname}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google Sheets falhou (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

export async function ensureSheetTabs(tabNames) {
  const spreadsheet = await sheetsFetch('');
  const existing = new Set(spreadsheet.sheets.map((sheet) => sheet.properties.title));
  const requests = tabNames
    .filter((title) => !existing.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length === 0) return;

  await sheetsFetch(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests }),
  });
}

export async function replaceTabRows(tabName, rows) {
  await ensureSheetTabs([tabName]);
  await sheetsFetch(`/values/${encodeRange(tabName)}:clear`, { method: 'POST' });
  await sheetsFetch(`/values/${encodeRange(tabName)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: rows }),
  });
}
