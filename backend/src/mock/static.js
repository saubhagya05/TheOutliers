// Benchmarks: the real numbers from `python ml/benchmark.py` (ml/data/benchmarks.json) when present.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../ml/data/benchmarks.json');

const placeholder = {
  simulatedLedger: {
    rings: { planted: 0, found: 0, falseAlerts: 0, precision: 0, recall: 0, f1: 0 },
    lone: { planted: 0, found: 0, falseAlerts: 0, precision: 0, recall: 0, f1: 0 },
  },
  public: [],
  notes: 'Benchmarks not run yet: python ml/benchmark.py',
  ranAt: null,
};

export const benchmarks = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : placeholder;
