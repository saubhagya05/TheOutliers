// Lone-ghost signals (docs/API.md 1.1) with a fixed colour each, so the graph, cards and detail agree.
export const LONE_SIGNALS = [
  { id: 'invalidAadhaar', label: 'Invalid Aadhaar', color: '#F43434', hint: 'Fails the Verhoeff checksum or format' },
  { id: 'expiredAadhaar', label: 'Expired Aadhaar', color: '#F6E35A', hint: 'Expired or deactivated, still paid' },
  { id: 'invalidPhone', label: 'Invalid phone', color: '#34D4F4', hint: 'Not a valid Indian mobile number' },
  { id: 'duplicatePhone', label: 'Duplicate phone', color: '#A434F4', hint: 'Shared with an unrelated record' },
  { id: 'loginBruteforce', label: 'Login brute force', color: '#5AF688', hint: 'Many failed logins, then success' },
  { id: 'oddHourRegistration', label: 'Odd-hour registration', color: '#F65AAF', hint: 'Registered between midnight and 6 am' },
];

export const SIGNAL_BY_ID = Object.fromEntries(LONE_SIGNALS.map((s) => [s.id, s]));

export const signalsOf = (item) => [...new Set((item.anomalies || []).map((a) => a.signal).filter((s) => SIGNAL_BY_ID[s]))];

export const topSignalOf = (item) => {
  const top = item.topReasons && item.topReasons[0] && item.topReasons[0].signal;
  return SIGNAL_BY_ID[top] ? top : signalsOf(item)[0] || 'oddHourRegistration';
};
