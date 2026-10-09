// Static content for the Dataset & Method page in mock mode. The ML service serves the real version.

export const datasetInfo = {
  name: 'Post-Matric Scholarship 2025-26 (mock data)',
  simulated: true,
  recordCount: 3000,
  generatedAt: '2026-09-26T18:00:00Z',
  description: 'Synthetic welfare ledger. Names, addresses and phones follow realistic Indian distributions. Fraud was planted afterwards with known labels, kept hidden from the detector.',
  columnGroups: [
    {
      group: 'Identity',
      columns: [
        { name: 'name', usedFor: ['ring', 'lone'], description: 'Applicant name (fuzzy + phonetic matching)' },
        { name: 'age, gender', usedFor: ['lone'], description: 'Eligibility checks' },
        { name: 'aadhaarHash', usedFor: ['ring'], description: 'Hashed Aadhaar, exact duplicate check' },
      ],
    },
    {
      group: 'Contact & location',
      columns: [
        { name: 'phone', usedFor: ['ring', 'lone'], description: 'Shared or batch phone numbers' },
        { name: 'address, pincode, district', usedFor: ['ring', 'lone'], description: 'Shared addresses, area-level anomalies' },
      ],
    },
    {
      group: 'Application',
      columns: [
        { name: 'agentId', usedFor: ['ring'], description: 'Agent / CSC that filed the application' },
        { name: 'deviceId, otpIp', usedFor: ['ring'], description: 'Device and IP that completed the OTP' },
        { name: 'appliedAt', usedFor: ['ring', 'lone'], description: 'Bursts and odd-hour applications' },
      ],
    },
    {
      group: 'Payment',
      columns: [
        { name: 'payoutAccount, ifsc', usedFor: ['ring', 'lone'], description: 'Shared payout accounts' },
        { name: 'accountOpenedAt', usedFor: ['ring', 'lone'], description: 'Batch-opened or very new accounts' },
        { name: 'minutesToWithdrawal', usedFor: ['lone'], description: 'Instant full withdrawal after payout' },
        { name: 'transferredTo', usedFor: ['ring'], description: 'Funds forwarded to a collector account' },
      ],
    },
    {
      group: 'Registry',
      columns: [{ name: 'enrolledInRegistry', usedFor: ['lone'], description: 'Student found in the enrolment registry (simulated cross-check)' }],
    },
  ],
  planted: {
    rings: 15,
    ringTypes: [
      { type: 'sharedAccount', count: 4, description: 'Many identities paying out to a few accounts' },
      { type: 'deviceOtp', count: 3, description: 'One device completes OTPs for many unrelated people' },
      { type: 'collectorAccount', count: 3, description: 'Payouts forwarded to one collector account' },
      { type: 'agentBurst', count: 2, description: 'One agent files many applications in a short window' },
      { type: 'sharedAddress / sharedPhone', count: 1, description: 'Shared address and phones' },
      { type: 'heldOut', count: 2, description: 'Ring types hidden from tuning' },
    ],
    loneGhosts: 128,
    hardNegatives: [
      { type: 'families', count: 300, description: 'Real families sharing one address' },
      { type: 'commonNames', count: 200, description: 'Unrelated people with very common names' },
      { type: 'selfHelpGroups', count: 6, description: 'Groups legitimately sharing one account' },
    ],
  },
  howCreated: [
    'Generated a base population from realistic name, address and pincode distributions.',
    'Added legitimate hard negatives: families sharing an address, common names, self-help-group accounts.',
    'Planted ring and lone-ghost fraud with ground-truth labels, kept separate from the detector.',
    'Held two ring types out of tuning to test generalisation.',
  ],
  pipeline: [
    { step: 'Blocking', description: 'Group records by pincode, phone prefix and name initials.' },
    { step: 'Linkage', description: 'Fuzzy + phonetic name match, exact match on account, phone, device, agent.' },
    { step: 'Graph', description: 'Records and shared items become nodes; shared attributes become edges.' },
    { step: 'Ring discovery', description: 'Connected components, Louvain, cycle and fan-in detection, burst windows.' },
    { step: 'Lone scoring', description: 'Rules + Isolation Forest over behaviour features.' },
    { step: 'Explain', description: 'Top contributing signals become reasons and red table cells.' },
  ],
  limitations: [
    'Real welfare fraud labels are not public, so the ledger is simulated.',
    'Results are on simulated fraud plus component benchmarks, not on real welfare data.',
  ],
};

export const benchmarks = {
  simulatedLedger: {
    rings: { planted: 15, found: 13, falseAlerts: 1, precision: 0.93, recall: 0.87, f1: 0.9 },
    lone: { planted: 128, found: 110, falseAlerts: 8, precision: 0.93, recall: 0.86, f1: 0.89 },
  },
  public: [
    { dataset: 'Febrl', component: 'Name/address matcher', precision: 0.95, recall: 0.93, f1: 0.94 },
    { dataset: 'NC Voter Registration', component: 'Name/address matcher', precision: 0.9, recall: 0.86, f1: 0.88 },
    { dataset: 'IBM AML', component: 'Cycle and collector detection', precision: 0.78, recall: 0.72, f1: 0.75 },
  ],
  notes: 'MOCK NUMBERS. Replace with real benchmark output. Public benchmarks test components only.',
  ranAt: '2026-09-27T08:00:00Z',
};
