import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class ComponentRegistry {
  constructor(file) {
    this.file = file;
    this.cache = null;
  }

  async load() {
    if (this.cache) return this.cache;
    let raw;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.cache = { components: {} };
      return this.cache;
    }

    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('component registry must be a JSON object');
    }
    if (!data.components || typeof data.components !== 'object' || Array.isArray(data.components)) {
      throw new Error('component registry must contain a components object');
    }
    this.cache = data;
    return this.cache;
  }

  async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.cache, null, 2));
  }

  async register(component) {
    const data = await this.load();
    const id = component.id || component.name;
    const record = {
      ...component,
      id,
      registeredAt: new Date().toISOString(),
      digest: crypto.createHash('sha256').update(JSON.stringify(component)).digest('hex')
    };
    data.components[id] = record;
    await this.save();
    return record;
  }

  async list() {
    const data = await this.load();
    return Object.values(data.components);
  }
}
