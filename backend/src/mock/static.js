// Benchmarks in mock mode. Replace with ml/data/benchmarks.json from the real benchmark run.

export const benchmarks = {
  simulatedLedger: {
    rings: { planted: 31, found: 28, falseAlerts: 2, precision: 0.93, recall: 0.9, f1: 0.92 },
    lone: { planted: 240, found: 196, falseAlerts: 31, precision: 0.86, recall: 0.82, f1: 0.84 },
  },
  public: [
    { dataset: 'Febrl', component: 'Name/address matcher', precision: 0.95, recall: 0.93, f1: 0.94 },
    { dataset: 'NC Voter Registration', component: 'Name/address matcher', precision: 0.9, recall: 0.86, f1: 0.88 },
    { dataset: 'IBM AML', component: 'Cycle and collector detection', precision: 0.78, recall: 0.72, f1: 0.75 },
  ],
  notes: 'MOCK NUMBERS. Replace with the real benchmark run on the held-out test set. Public benchmarks test components only.',
  ranAt: '2026-09-27T08:00:00Z',
};
