/** Map raw "Regra XX" codes from RubinOT to human-readable English labels */
const RULE_LABELS: Record<string, string> = {
  // 1 — Names
  'Regra 1A': 'Name Violation',
  'Regra 1B': 'Offensive Name',
  'Regra 1C': 'Inappropriate Name',
  // 2 — Cheating
  'Regra 2A': 'Bug Abuse',
  'Regra 2B': 'Multi-Client',
  'Regra 2C': 'Illegal Software',
  'Regra 2D': 'Check Abuse',
  'Regra 2E': 'False Reports',
  'Regra 2F': 'Training Automation',
  'Regra 2G': 'KS / Lure / Trap',
  'Regra 2H': 'RTC Automation',
  // 3 — Messages & Statements
  'Regra 3A': 'Offensive Conduct',
  'Regra 3B': 'Sharing Personal Data',
  'Regra 3C': 'Advertising',
  'Regra 3D': 'Spam',
  'Regra 3E': 'Supporting Violations',
  // 4 — Sales
  'Regra 4A': 'Bazaar Fraud',
  'Regra 4B': 'Fraudulent Transactions',
  'Regra 4C': 'Illegal Announcements',
  'Regra 4D': 'Market Fraud',
  // 5 — Channel Conduct
  'Regra 5A': 'Help Channel Abuse',
  'Regra 5B': 'Channel Advertising',
  'Regra 5C': 'World Chat Abuse',
  'Regra 5D': 'Casino Activity',
  // 6 — Company & Legal
  'Regra 6A': 'Impersonating Staff',
  'Regra 6B': 'Slander',
  'Regra 6C': 'Attacking Services',
  'Regra 6D': 'Law Violation',
};

/** Convert a raw ban reason (e.g. "Regra 2C") to a readable label (e.g. "Illegal Software") */
export function mapBanReason(raw: string | null): string | null {
  if (!raw) return null;
  return RULE_LABELS[raw.trim()] ?? raw;
}
