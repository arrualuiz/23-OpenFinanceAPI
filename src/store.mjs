import fs from 'node:fs/promises';
import path from 'node:path';

const defaultState = {
  items: [],
  snapshots: [],
};

export class Store {
  constructor(rootDir = process.cwd()) {
    this.file = path.join(rootDir, 'data', 'finance-store.json');
  }

  async read() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      return { ...defaultState, ...JSON.parse(raw) };
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(defaultState);
      throw error;
    }
  }

  async write(state) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(state, null, 2));
  }

  async saveItem(item) {
    const state = await this.read();
    const itemId = item.id || item.itemId;
    if (!itemId) throw new Error('Item sem id retornado pela Pluggy.');

    const record = {
      id: itemId,
      connector: item.connector?.name || item.connector?.institutionName || item.connector?.id || '',
      executionStatus: item.executionStatus || '',
      status: item.status || '',
      updatedAt: new Date().toISOString(),
      raw: item,
    };

    const existingIndex = state.items.findIndex((entry) => entry.id === itemId);
    if (existingIndex >= 0) state.items[existingIndex] = record;
    else state.items.push(record);

    await this.write(state);
    return record;
  }

  async listItems() {
    const state = await this.read();
    return state.items;
  }

  async saveSnapshot(snapshot) {
    const state = await this.read();
    state.snapshots.unshift(snapshot);
    state.snapshots = state.snapshots.slice(0, 30);
    await this.write(state);
    return snapshot;
  }

  async latestSnapshot() {
    const state = await this.read();
    return state.snapshots[0] || null;
  }
}
