/* ============================================================
   PayDay JM — Main App Logic (v2.0)
   ============================================================ */

'use strict';

// ─── ID Generator ───────────────────────────────────────────
function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Jamaican Public Holidays ───────────────────────────────
const JM_FIXED_HOLIDAYS = [
  { month: 1,  day: 1,  name: "New Year's Day" },
  { month: 5,  day: 23, name: "Labour Day" },
  { month: 8,  day: 1,  name: "Emancipation Day" },
  { month: 8,  day: 6,  name: "Independence Day" },
  { month: 12, day: 25, name: "Christmas Day" },
  { month: 12, day: 26, name: "Boxing Day" },
];

function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function heroesDay(year) {
  const d = new Date(year, 9, 1); let mondays = 0;
  while (mondays < 3) { if (d.getDay() === 1) mondays++; if (mondays < 3) d.setDate(d.getDate() + 1); }
  return d;
}

function getJmHolidays(year) {
  const holidays = new Set();
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const add = d => holidays.add(dateKey(d));
  JM_FIXED_HOLIDAYS.forEach(h => {
    const d = new Date(year, h.month - 1, h.day); add(d);
    if (d.getDay() === 0 && h.name !== 'Labour Day') { const mon = new Date(d); mon.setDate(mon.getDate() + 1); add(mon); }
  });
  const easter = easterDate(year);
  const gf = new Date(easter); gf.setDate(gf.getDate() - 2);
  const em = new Date(easter); em.setDate(em.getDate() + 1);
  const ash = new Date(easter); ash.setDate(ash.getDate() - 46);
  [ash, gf, easter, em, heroesDay(year)].forEach(add);
  return holidays;
}

// ─── Payday Calculator ──────────────────────────────────────
function calculateMonthlyPayday(year, month) {
  const holidays = getJmHolidays(year);
  let d = new Date(year, month - 1, 25);
  const dateKey = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  while ([0,6].includes(d.getDay()) || holidays.has(dateKey(d))) { d.setDate(d.getDate() - 1); }
  return d;
}

function nextPayday() {
  const today = new Date(); today.setHours(0,0,0,0);
  const yr = today.getFullYear(), mo = today.getMonth() + 1;
  const freq = state.settings.payFrequency || 'monthly';

  if (freq === 'monthly') {
    let pd = calculateMonthlyPayday(yr, mo);
    if (pd < today) {
      const nm = mo === 12 ? 1 : mo + 1, ny = mo === 12 ? yr + 1 : yr;
      pd = calculateMonthlyPayday(ny, nm);
    }
    return pd;
  }

  if (freq === 'fortnightly') {
    // Next occurrence of anchor day or 2 weeks before it
    let d = new Date(today);
    for (let i = 1; i <= 14; i++) {
      d.setDate(d.getDate() + 1);
      if (d.getDate() === 25 || d.getDate() === 11) return d;
    }
    return d;
  }

  if (freq === 'weekly') {
    let d = new Date(today);
    const targetDay = 5; // Friday
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === targetDay) return d;
    }
    return d;
  }

  return calculateMonthlyPayday(yr, mo);
}

function daysUntil(date) {
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((date - today) / 86400000);
}

function formatDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatJMD(amount) {
  return 'J$' + Number(amount).toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── State / Storage ────────────────────────────────────────
const STORAGE_KEY = 'payday_jm_v2';

const defaultState = {
  salary: 150000,
  onboardingDone: false,
  bills: [
    { id: genId(), name: 'Rent',        icon: '🏠', amount: 45000, dueDay: 1,  frequency: 'monthly', paid: false, originalAmount: 45000 },
    { id: genId(), name: 'JPS (Light)', icon: '💡', amount: 8500,  dueDay: 15, frequency: 'monthly', paid: false, originalAmount: 8500 },
    { id: genId(), name: 'NWC (Water)', icon: '💧', amount: 3200,  dueDay: 20, frequency: 'monthly', paid: false, originalAmount: 3200 },
    { id: genId(), name: 'Internet',    icon: '📶', amount: 5000,  dueDay: 10, frequency: 'monthly', paid: false, originalAmount: 5000 },
    { id: genId(), name: 'Phone',       icon: '📱', amount: 4500,  dueDay: 5,  frequency: 'monthly', paid: false, originalAmount: 4500 },
  ],
  debts: [
    { id: genId(), name: 'Credit Card',   balance: 120000, originalBalance: 120000, minPayment: 8000,  rate: 24.5, dueDay: 22 },
    { id: genId(), name: 'Personal Loan', balance: 350000, originalBalance: 350000, minPayment: 15000, rate: 18,   dueDay: 28 },
  ],
  goals: [
    { id: genId(), name: 'Emergency Fund', icon: '🛡️', color: '#4caf82', target: 200000, saved: 45000,  targetDate: '2026-12-31' },
    { id: genId(), name: 'Vacation',        icon: '✈️', color: '#5b8ff9', target: 80000,  saved: 12000,  targetDate: '2026-08-01' },
  ],
  expenses: [
    { id: genId(), category: 'Groceries',    amount: 15000, date: '2026-04-10', note: 'Hi-Lo supermarket' },
    { id: genId(), category: 'Transport',    amount: 8500,  date: '2026-04-08', note: 'Taxi & bus fares' },
    { id: genId(), category: 'Dining',       amount: 4200,  date: '2026-04-12', note: 'Lunch x3' },
    { id: genId(), category: 'Utilities',    amount: 3200,  date: '2026-04-05', note: 'NWC payment' },
    { id: genId(), category: 'Entertainment',amount: 2500,  date: '2026-04-14', note: 'Cinema' },
    { id: genId(), category: 'Groceries',    amount: 12000, date: '2026-03-22', note: 'Sovereign supermarket' },
    { id: genId(), category: 'Transport',    amount: 7200,  date: '2026-03-18', note: 'Weekly fares' },
    { id: genId(), category: 'Dining',       amount: 5100,  date: '2026-03-15', note: 'Team lunch' },
  ],
  categories: ['Groceries','Transport','Dining','Utilities','Entertainment','Health','Education','Clothing','Other'],
  categoryLimits: { Groceries: 20000, Transport: 10000, Dining: 8000, Entertainment: 5000 },
  settings: {
    reminderDays: 3,
    notificationsEnabled: false,
    currency: 'JMD',
    payFrequency: 'monthly',
  },
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Deep merge settings, keep arrays from saved
      return {
        ...defaultState,
        ...saved,
        settings: { ...defaultState.settings, ...(saved.settings || {}) },
      };
    }
    return JSON.parse(JSON.stringify(defaultState));
  } catch { return JSON.parse(JSON.stringify(defaultState)); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// ─── Computed helpers ───────────────────────────────────────
function totalBills()        { return state.bills.reduce((s, b) => s + b.amount, 0); }
function totalDebtPayments() { return state.debts.reduce((s, d) => s + d.minPayment, 0); }
function available()         { return state.salary - totalBills() - totalDebtPayments(); }

function billsDueSoon(days = state.settings.reminderDays) {
  const d = new Date().getDate();
  return state.bills.filter(b => { const diff = b.dueDay - d; return diff >= 0 && diff <= days; });
}

function catColor(cat) {
  const c = { Groceries:'#4caf82', Transport:'#5b8ff9', Dining:'#e8a83a', Utilities:'#c8a96e', Entertainment:'#e05c5c', Health:'#a78bfa', Education:'#34d399', Clothing:'#f472b6', Other:'#8a91a8' };
  return c[cat] || '#8a91a8';
}

function getExpensesForMonth(year, month) {
  return state.expenses.filter(e => { const d = new Date(e.date); return d.getFullYear() === year && (d.getMonth()+1) === month; });
}

// ─── UI State ───────────────────────────────────────────────
let spendingMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
let billView = 'list';
let onboardingStep = 0;
let activeFilter = null;

// ─── Onboarding ─────────────────────────────────────────────
function renderOnboarding() {
  const steps = [
    { emoji:'👋', title:"Welcome to PayDay JM", desc:"Your personal finance companion, built for Jamaican professionals. Let's set up your account in 3 quick steps.", action:`<button class="btn btn-primary btn-block" onclick="onboardNext()">Get Started →</button>` },
    { emoji:'💼', title:"What's your monthly salary?", desc:"Enter your gross monthly income. You can always update this in Settings.",
      action:`<div class="form-group"><label class="form-label">Monthly Gross (J$)</label><div class="input-prefix"><input class="form-input" type="number" id="ob-salary" value="${state.salary}" placeholder="150000" /></div></div><button class="btn btn-primary btn-block" onclick="onboardSetSalary()">Continue →</button>` },
    { emoji:'📋', title:"Add your first bill", desc:"What's your biggest regular expense? You can add more from the Bills tab.",
      action:`<div class="form-group"><label class="form-label">Bill Name</label><input class="form-input" id="ob-bill-name" type="text" placeholder="e.g. Rent, JPS, Internet" /></div><div class="form-group"><label class="form-label">Amount (J$)</label><div class="input-prefix"><input class="form-input" id="ob-bill-amount" type="number" placeholder="0.00" /></div></div><div class="form-group"><label class="form-label">Due Day of Month</label><input class="form-input" id="ob-bill-due" type="number" min="1" max="31" placeholder="e.g. 1" /></div><div style="display:flex;gap:10px;"><button class="btn btn-primary" style="flex:1" onclick="onboardAddBill()">Add Bill</button><button class="btn btn-ghost" onclick="onboardSkip()">Skip</button></div>` },
    { emoji:'🎯', title:"Set a savings goal", desc:"What are you saving towards? Emergency fund, vacation, or something else?",
      action:`<div class="form-group"><label class="form-label">Goal Name</label><input class="form-input" id="ob-goal-name" type="text" placeholder="e.g. Emergency Fund" /></div><div class="form-group"><label class="form-label">Target Amount (J$)</label><div class="input-prefix"><input class="form-input" id="ob-goal-target" type="number" placeholder="0.00" /></div></div><div style="display:flex;gap:10px;"><button class="btn btn-primary" style="flex:1" onclick="onboardAddGoal()">Create Goal</button><button class="btn btn-ghost" onclick="onboardSkip()">Skip</button></div>` },
  ];

  if (onboardingStep >= steps.length) { state.onboardingDone = true; saveState(); navigate('dashboard'); return ''; }
  const s = steps[onboardingStep];
  return `<div class="onboarding-wrap fade-up">
    <div class="ob-progress">${steps.map((_,i) => `<div class="ob-dot ${i <= onboardingStep ? 'active' : ''}"></div>`).join('')}</div>
    <div class="ob-emoji">${s.emoji}</div>
    <div class="ob-title">${s.title}</div>
    <div class="ob-desc">${s.desc}</div>
    <div class="ob-action">${s.action}</div>
  </div>`;
}

function onboardNext() { onboardingStep++; navigate('onboarding'); }
function onboardSkip() { onboardingStep++; if (onboardingStep >= 4) { state.onboardingDone = true; saveState(); navigate('dashboard'); } else navigate('onboarding'); }
function onboardSetSalary() {
  const v = parseFloat(document.getElementById('ob-salary')?.value); if (v > 0) { state.salary = v; saveState(); }
  onboardNext();
}
function onboardAddBill() {
  const name = document.getElementById('ob-bill-name')?.value.trim();
  const amount = parseFloat(document.getElementById('ob-bill-amount')?.value);
  const dueDay = parseInt(document.getElementById('ob-bill-due')?.value);
  if (name && amount && dueDay) { state.bills.push({ id: genId(), name, icon: '💳', amount, dueDay, frequency: 'monthly', paid: false, originalAmount: amount }); saveState(); }
  onboardNext();
}
function onboardAddGoal() {
  const name = document.getElementById('ob-goal-name')?.value.trim();
  const target = parseFloat(document.getElementById('ob-goal-target')?.value);
  if (name && target) {
    const td = new Date(); td.setFullYear(td.getFullYear() + 1);
    state.goals.push({ id: genId(), name, icon: '🎯', color: '#c8a96e', target, saved: 0, targetDate: td.toISOString().split('T')[0] });
    saveState();
  }
  state.onboardingDone = true; saveState(); navigate('dashboard');
}

// ─── Dashboard ───────────────────────────────────────────────
function renderDashboard() {
  const pd = nextPayday();
  const days = daysUntil(pd);
  const avail = available();
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, days / 31)));
  const alerts = billsDueSoon();

  const nextBill = [...state.bills].filter(b => !b.paid).sort((a,b) => {
    const t = new Date().getDate();
    return (a.dueDay >= t ? a.dueDay - t : a.dueDay + 31 - t) - (b.dueDay >= t ? b.dueDay - t : b.dueDay + 31 - t);
  })[0];

  const topGoal = state.goals[0];
  const topGoalPct = topGoal ? Math.round((topGoal.saved / topGoal.target) * 100) : 0;
  const totalDebt = state.debts.reduce((s,d) => s + d.balance, 0);

  return `
    ${alerts.length ? `<div class="card card-sm fade-up" style="border-color:rgba(232,168,58,0.4);background:rgba(232,168,58,0.06);margin-top:16px;">
      <div class="flex items-center gap-2" style="color:var(--amber)"><span>⚠️</span><span style="font-size:.82rem;font-weight:600;">${alerts.length} bill${alerts.length>1?'s':''} due within ${state.settings.reminderDays} days</span></div>
      <div style="margin-top:6px;font-size:.75rem;color:var(--text-dim)">${alerts.map(b => `${b.name} — due ${b.dueDay}${getDaySuffix(b.dueDay)}`).join(' · ')}</div>
    </div>` : ''}

    <div class="card card-gold payday-hero fade-up" onclick="openSalaryEdit()" style="cursor:pointer;" title="Tap to update salary">
      <p class="label">Available this pay period</p>
      <div class="hero-row">
        <div>
          <div class="amount-large"><span class="currency">J$</span>${Number(avail).toLocaleString('en-JM',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="pill ${avail > 0 ? 'pill-green' : 'pill-red'}">${avail > 0 ? '✓ Positive' : '⚠ Deficit'}</span>
            <span class="pill pill-muted">of ${formatJMD(state.salary)}</span>
          </div>
        </div>
        <div class="countdown-ring">
          <svg viewBox="0 0 60 60">
            <circle class="ring-bg" cx="30" cy="30" r="28" />
            <circle class="ring-fill" cx="30" cy="30" r="28" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" data-target="${dashOffset}" />
          </svg>
          <div class="ring-text"><div style="font-size:1.05rem;font-weight:700;color:var(--coral)">${days}</div><div>days</div></div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="flex justify-between" style="font-size:.8rem;color:var(--text-dim)">
        <span>Next payday: <strong class="text-coral">${formatDate(pd)}</strong></span>
        <span>${pd.toLocaleDateString('en-JM',{weekday:'long'})} · ✏️ tap to edit</span>
      </div>
    </div>

    <div class="budget-row fade-up">
      <div class="budget-stat card-sm"><div class="label">Bills</div><div class="value text-red">${formatJMD(totalBills())}</div></div>
      <div class="budget-stat card-sm"><div class="label">Debt pmts</div><div class="value text-red">${formatJMD(totalDebtPayments())}</div></div>
      <div class="budget-stat card-sm"><div class="label">Salary</div><div class="value text-green">${formatJMD(state.salary)}</div></div>
    </div>

    ${nextBill ? `<div class="section-label">Next Bill Due</div>
    <div class="card-sm fade-up"><div class="bill-item" style="padding:0;border:none;">
      <div class="bill-icon">${nextBill.icon}</div>
      <div class="bill-info"><div class="bill-name">${nextBill.name}</div><div class="bill-meta">Due ${nextBill.dueDay}${getDaySuffix(nextBill.dueDay)} — ${getDaysUntilDay(nextBill.dueDay)} days</div></div>
      <div class="bill-amount">${formatJMD(nextBill.amount)}</div>
    </div></div>` : ''}

    ${topGoal ? `<div class="section-label">Top Savings Goal</div>
    <div class="card-sm fade-up">
      <div class="goal-row"><span class="goal-name">${topGoal.icon||'🎯'} ${topGoal.name}</span><span class="goal-pct">${topGoalPct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${topGoalPct}%;background:${topGoal.color||'var(--coral)'}"></div></div>
      <div class="goal-meta">${formatJMD(topGoal.saved)} of ${formatJMD(topGoal.target)} · target ${topGoal.targetDate}</div>
    </div>` : ''}

    <div class="section-label">Total Debt</div>
    <div class="card-sm fade-up"><div class="flex justify-between items-center">
      <span class="text-dim" style="font-size:.85rem;">Outstanding balance</span>
      <span class="mono bold text-red">${formatJMD(totalDebt)}</span>
    </div></div>
  `;
}

function openSalaryEdit() {
  document.getElementById('salary-quick-val').value = state.salary;
  openModal('modal-salary-quick');
}

// ─── Bills ──────────────────────────────────────────────────
function renderBills() {
  const today = new Date().getDate();
  const sortedBills = [...state.bills].sort((a,b) => a.dueDay - b.dueDay);
  const sortedDebts = [...state.debts].sort((a,b) => (a.dueDay||1) - (b.dueDay||1));

  const listView = `<div class="card fade-up">
    ${sortedBills.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No bills yet</div><div class="empty-desc">Tap + to add your first bill</div></div>`
      : sortedBills.map(b => {
          const diff = b.dueDay - today;
          const statusClass = b.paid ? '' : diff < 0 ? 'overdue' : diff <= 3 ? 'soon' : '';
          const statusLabel = b.paid ? '✓ Paid' : diff < 0 ? 'Overdue' : diff <= 3 ? `Due in ${diff}d` : `Due ${b.dueDay}${getDaySuffix(b.dueDay)}`;
          return `<div class="bill-item">
            <div class="bill-icon">${b.icon}</div>
            <div class="bill-info"><div class="bill-name">${b.name}</div><div class="bill-meta">${statusLabel} · ${b.frequency}</div></div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              <div class="bill-amount ${statusClass}">${formatJMD(b.amount)}</div>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-sm ${b.paid?'btn-ghost':'btn-primary'}" style="padding:4px 10px;font-size:.7rem;" onclick="togglePaid('${b.id}')">${b.paid?'Unmark':'Mark Paid'}</button>
                <button class="btn btn-sm btn-ghost" style="padding:4px 7px;" onclick="editBill('${b.id}')">✏️</button>
                <button class="btn btn-sm btn-ghost" style="padding:4px 7px;color:var(--red);" onclick="deleteBill('${b.id}')">🗑</button>
              </div>
            </div>
          </div>`;
        }).join('')}
  </div>`;

  return `
    <div class="section-header">
      <div class="section-label" style="margin:0">Bills (${state.bills.length})</div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="text-dim mono" style="font-size:.8rem;">${formatJMD(totalBills())}/mo</span>
        <div class="view-toggle">
          <button class="vt-btn ${billView==='list'?'active':''}" onclick="setBillView('list')">☰</button>
          <button class="vt-btn ${billView==='calendar'?'active':''}" onclick="setBillView('calendar')">📅</button>
        </div>
      </div>
    </div>
    ${billView === 'list' ? listView : renderBillCalendar()}

    <div class="section-header">
      <div class="section-label" style="margin:0">Debts (${state.debts.length})</div>
      <span class="text-dim mono" style="font-size:.8rem;">${formatJMD(state.debts.reduce((s,d)=>s+d.balance,0))} total</span>
    </div>
    <div class="card fade-up">
      ${state.debts.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">No debts tracked</div><div class="empty-desc">Add debts to see payoff plans</div></div>`
        : sortedDebts.map(d => {
            const progressPct = d.originalBalance ? Math.min(100, Math.round(((d.originalBalance - d.balance) / d.originalBalance) * 100)) : 0;
            const monthsLeft = d.minPayment > 0 ? Math.ceil(d.balance / d.minPayment) : '∞';
            const plan = renderDebtPlan(d);
            return `<div class="debt-item">
              <div class="debt-row">
                <div class="debt-name">${d.name}</div>
                <div style="display:flex;gap:5px;align-items:center;">
                  <div class="debt-balance">${formatJMD(d.balance)}</div>
                  <button class="btn btn-sm btn-ghost" style="padding:3px 6px;" onclick="editDebt('${d.id}')">✏️</button>
                  <button class="btn btn-sm btn-ghost" style="padding:3px 6px;color:var(--red);" onclick="deleteDebt('${d.id}')">🗑</button>
                </div>
              </div>
              <div class="debt-details"><span>Min: ${formatJMD(d.minPayment)}/mo</span><span>${d.rate}% APR</span><span>~${monthsLeft} months</span></div>
              <div class="progress-track"><div class="progress-fill red" style="width:${progressPct}%"></div></div>
              <div class="goal-meta" style="margin-top:5px;">${progressPct}% paid · Due ${d.dueDay||'–'}${getDaySuffix(d.dueDay||1)} each month</div>
              <div class="divider" style="margin:10px 0;"></div>
              <div style="font-size:.7rem;color:var(--muted);font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">Payoff Plan</div>
              ${plan}
            </div>`;
          }).join('')}
    </div>
  `;
}

function renderDebtPlan(d) {
  if (!d.rate || !d.minPayment || d.balance <= 0) return `<div style="font-size:.72rem;color:var(--text-dim)">Add interest rate & minimum payment to see payoff estimate.</div>`;
  const mRate = d.rate / 100 / 12;
  let bal = d.balance, months = 0, totalInterest = 0;
  while (bal > 0 && months < 360) {
    const interest = bal * mRate; totalInterest += interest;
    const principal = d.minPayment - interest;
    if (principal <= 0) { months = 999; break; }
    bal -= principal; months++;
  }
  const payoffDate = new Date(); payoffDate.setMonth(payoffDate.getMonth() + months);
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.75rem;">
    <div><div style="color:var(--text-dim)">Payoff date</div><div style="color:var(--text-hi);font-weight:500;">${months < 360 ? payoffDate.toLocaleDateString('en-JM',{month:'short',year:'numeric'}) : 'Min payment too low'}</div></div>
    <div><div style="color:var(--text-dim)">Total interest</div><div style="color:var(--red);font-weight:500;">${months < 360 ? formatJMD(totalInterest) : '—'}</div></div>
  </div>`;
}

function renderBillCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;
  const pd = nextPayday();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  return `<div class="card fade-up">
    <div style="text-align:center;font-family:var(--ff-display);font-size:.95rem;color:var(--coral);margin-bottom:10px;">${now.toLocaleDateString('en-JM',{month:'long',year:'numeric'})}</div>
    <div class="cal-grid">
      ${['S','M','T','W','T','F','S'].map(d=>`<div class="cal-day-head">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div class="cal-day"></div>').join('')}
      ${Array.from({length:daysInMonth},(_,i)=>{
        const day = i+1;
        const bills = state.bills.filter(b=>b.dueDay===day);
        const isToday = day === now.getDate();
        const isPayday = pd.getDate()===day && pd.getMonth()===month-1;
        const cls=[isToday?'today':'',isPayday?'payday':'',bills.length?'has-bill':''].filter(Boolean).join(' ');
        const dots = bills.slice(0,3).map(b=>`<div class="cal-dot" style="background:${b.paid?'var(--teal)':'var(--coral)'}"></div>`).join('');
        return `<div class="cal-day ${cls}" title="${bills.map(b=>b.name).join(', ')}">${day}${dots}</div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:16px;margin-top:12px;font-size:.7rem;color:var(--text-dim);">
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:var(--coral)"></div>Bill due</div>
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:var(--green)"></div>Paid</div>
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:8px;height:8px;border-radius:50%;background:rgba(200,169,110,.3);border:1px solid var(--coral)"></div>Payday</div>
    </div>
  </div>`;
}

function setBillView(v) { billView = v; navigate(currentPage); }

// ─── Spending ───────────────────────────────────────────────
function renderSpending() {
  const { year, month } = spendingMonth;
  const expenses = getExpensesForMonth(year, month);
  const monthLabel = new Date(year, month-1, 1).toLocaleDateString('en-JM',{month:'long',year:'numeric'});
  const isCurrentMonth = year===new Date().getFullYear() && month===new Date().getMonth()+1;
  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category]||0) + e.amount; });
  const total = Object.values(byCategory).reduce((s,v)=>s+v,0);
  const cats  = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  let offset = 0;
  const r=52, co=60, circum=2*Math.PI*r;
  const svgSegments = cats.map(([cat,amt]) => {
    const frac=amt/total, dash=frac*circum, gap=circum-dash, rot=offset*360-90;
    const s=`<circle cx="${co}" cy="${co}" r="${r}" fill="none" stroke="${catColor(cat)}" stroke-width="16" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="0" transform="rotate(${rot} ${co} ${co})" />`;
    offset+=frac; return s;
  });

  return `
    <div class="section-header">
      <div class="section-label" style="margin:0">Spending</div>
      <div class="month-nav">
        <button class="mn-btn" onclick="shiftMonth(-1)">‹</button>
        <span style="font-size:.8rem;color:var(--text);font-weight:500;">${monthLabel}</span>
        <button class="mn-btn ${isCurrentMonth?'mn-disabled':''}" onclick="shiftMonth(1)" ${isCurrentMonth?'disabled':''}>›</button>
      </div>
    </div>
    ${expenses.length === 0 ? `<div class="card fade-up"><div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No expenses for ${monthLabel}</div><div class="empty-desc">${isCurrentMonth?'Tap + to log your first expense':'Nothing recorded for this month'}</div></div></div>` : `
    <div class="card fade-up">
      <div class="donut-wrap">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--raised)" stroke-width="16"/>
          ${svgSegments.join('')}
          <text x="60" y="56" text-anchor="middle" fill="var(--text-hi)" font-size="11" font-family="JetBrains Mono">Total</text>
          <text x="60" y="70" text-anchor="middle" fill="var(--coral)" font-size="10" font-family="JetBrains Mono">J$${(total/1000).toFixed(0)}k</text>
        </svg>
        <div class="donut-legend">
          ${cats.slice(0,4).map(([cat,amt])=>`<div class="category-item" style="cursor:pointer;" onclick="filterExpenses('${cat}')">
            <div class="cat-dot" style="background:${catColor(cat)}"></div>
            <div class="cat-info"><div class="cat-row"><span class="cat-name">${cat}</span><span class="cat-amount">${formatJMD(amt)}</span></div>
            <div class="progress-track" style="height:3px;"><div class="progress-fill" style="width:${Math.round((amt/total)*100)}%;background:${catColor(cat)}"></div></div></div>
          </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="section-label">Categories <span style="font-size:.68rem;color:var(--text-dim);text-transform:none;letter-spacing:0;">(tap to filter)</span></div>
    ${cats.map(([cat,amt]) => {
      const limit = state.categoryLimits[cat], over = limit && amt > limit;
      return `<div class="card-sm fade-up" style="cursor:pointer;" onclick="filterExpenses('${cat}')">
        <div class="cat-row" style="margin-bottom:8px;">
          <div class="flex items-center gap-2"><div class="cat-dot" style="background:${catColor(cat)};width:12px;height:12px;"></div><span class="cat-name bold">${cat}</span>${over?'<span class="pill pill-red" style="font-size:.65rem;">Over limit</span>':''}</div>
          <span class="mono" style="font-size:.9rem;color:${over?'var(--red)':'var(--text-hi)'}">${formatJMD(amt)}</span>
        </div>
        ${limit?`<div class="progress-track"><div class="progress-fill ${over?'red':''}" style="width:${Math.min(100,Math.round((amt/limit)*100))}%;${over?'':'background:'+catColor(cat)}"></div></div><div class="goal-meta" style="margin-top:4px;">Budget: ${formatJMD(limit)} · ${Math.round((amt/limit)*100)}% used</div>`:''}
      </div>`;
    }).join('')}
    <div class="section-label">Recent Expenses</div>
    <div id="expense-list" class="card fade-up">${renderExpenseList(expenses, null)}</div>`}
  `;
}

function renderExpenseList(expenses, filterCat) {
  const list = filterCat ? expenses.filter(e=>e.category===filterCat) : expenses;
  if (!list.length) return `<div style="color:var(--text-dim);font-size:.85rem;text-align:center;padding:16px;">No expenses${filterCat?' in '+filterCat:''}</div>`;
  return [...list].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(e=>`
    <div class="bill-item">
      <div class="bill-icon" style="background:${catColor(e.category)}20;font-size:.8rem;width:34px;height:34px;color:${catColor(e.category)};font-weight:700;">${e.category[0]}</div>
      <div class="bill-info"><div class="bill-name">${e.note||e.category}</div><div class="bill-meta">${e.category} · ${e.date}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="bill-amount">${formatJMD(e.amount)}</div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-sm btn-ghost" style="padding:2px 6px;" onclick="editExpense('${e.id}')">✏️</button>
          <button class="btn btn-sm btn-ghost" style="padding:2px 6px;color:var(--red);" onclick="deleteExpense('${e.id}')">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

function filterExpenses(cat) {
  activeFilter = activeFilter === cat ? null : cat;
  const expenses = getExpensesForMonth(spendingMonth.year, spendingMonth.month);
  const el = document.getElementById('expense-list');
  if (el) el.innerHTML = renderExpenseList(expenses, activeFilter);
}

function shiftMonth(dir) {
  let { year, month } = spendingMonth;
  month += dir;
  if (month > 12) { month = 1; year++; }
  if (month < 1)  { month = 12; year--; }
  const now = new Date();
  if (year > now.getFullYear() || (year===now.getFullYear() && month>now.getMonth()+1)) return;
  spendingMonth = { year, month };
  navigate(currentPage);
}

// ─── Goals ──────────────────────────────────────────────────
function renderGoals() {
  const pd = nextPayday();
  return `
    <div class="section-header">
      <div class="section-label" style="margin:0">Savings Goals</div>
      <span class="text-dim" style="font-size:.75rem;">${state.goals.length} active</span>
    </div>
    ${state.goals.length === 0 ? `<div class="card fade-up"><div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">No goals yet</div><div class="empty-desc">Tap + to create your first savings goal</div></div></div>` :
    state.goals.map(g => {
      const pct = Math.round((g.saved/g.target)*100);
      const months = Math.max(1, Math.ceil((new Date(g.targetDate)-pd)/(30*86400000)));
      const monthly = Math.max(0, (g.target-g.saved)/months);
      return `<div class="card fade-up">
        <div class="goal-row">
          <span class="goal-name" style="font-size:1rem;">${g.icon||'🎯'} ${g.name}</span>
          <span class="pill ${pct>=100?'pill-green':'pill-gold'}">${pct}%</span>
        </div>
        <div class="progress-track" style="height:8px;margin:10px 0;">
          <div class="progress-fill ${pct>=100?'green':''}" style="width:${Math.min(100,pct)}%;background:${pct<100?(g.color||'var(--coral)'):'var(--teal)'}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div><div class="label">Saved</div><div class="value mono">${formatJMD(g.saved)}</div></div>
          <div><div class="label">Target</div><div class="value mono">${formatJMD(g.target)}</div></div>
          <div><div class="label">Per paycheck needed</div><div class="value mono text-gold">${formatJMD(monthly)}</div></div>
          <div><div class="label">Target date</div><div class="value">${g.targetDate}</div></div>
        </div>
        <div class="divider"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="openAddSavingsModal('${g.id}')">+ Add funds</button>
          <button class="btn btn-ghost btn-sm" onclick="editGoal('${g.id}')">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteGoal('${g.id}')">Delete</button>
        </div>
      </div>`;
    }).join('')}
    <button class="btn btn-ghost btn-block" style="margin-top:4px;" onclick="openModal('modal-goal')">＋ New Goal</button>
  `;
}

// ─── Settings ───────────────────────────────────────────────
function renderSettings() {
  const pd = nextPayday();
  return `
    <div class="section-label">Payday Info</div>
    <div class="card fade-up">
      <div class="flex justify-between items-center">
        <div><div class="value bold">Next Payday</div><div class="text-dim" style="font-size:.8rem;">Calculated per Jamaican banking rules</div></div>
        <div class="text-gold mono bold">${formatDate(pd)}</div>
      </div>
      <div class="divider"></div>
      <div class="setting-row" style="padding:8px 0 0;">
        <div class="setting-info"><div class="setting-name">Pay Frequency</div><div class="setting-desc">How often you receive your salary</div></div>
        <select class="form-select" style="width:130px;" onchange="updatePayFrequency(this.value)">
          <option value="monthly" ${state.settings.payFrequency==='monthly'?'selected':''}>Monthly</option>
          <option value="fortnightly" ${state.settings.payFrequency==='fortnightly'?'selected':''}>Fortnightly</option>
          <option value="weekly" ${state.settings.payFrequency==='weekly'?'selected':''}>Weekly</option>
        </select>
      </div>
    </div>

    <div class="section-label">Salary</div>
    <div class="card fade-up">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Monthly Gross (J$)</label>
        <div class="input-prefix"><input class="form-input" type="number" id="salary-input" value="${state.salary}" onchange="updateSalary(this.value)" /></div>
      </div>
    </div>

    <div class="section-label">Notifications</div>
    <div class="card fade-up">
      <div class="setting-row">
        <div class="setting-info"><div class="setting-name">Bill Reminders</div><div class="setting-desc">Get notified before bills are due</div></div>
        <div class="toggle ${state.settings.notificationsEnabled?'on':''}" onclick="toggleNotifications()"></div>
      </div>
      <div class="setting-row">
        <div class="setting-info"><div class="setting-name">Reminder Timing</div><div class="setting-desc">Days before due date</div></div>
        <select class="form-select" style="width:80px;" onchange="updateReminderDays(this.value)">
          ${[1,2,3,5,7].map(d=>`<option value="${d}" ${state.settings.reminderDays===d?'selected':''}>${d}d</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="section-label">Data</div>
    <div class="card fade-up">
      <div class="setting-row">
        <div class="setting-info"><div class="setting-name">Export CSV</div><div class="setting-desc">Download all expenses as spreadsheet</div></div>
        <button class="btn btn-ghost btn-sm" onclick="exportCSV()">Export</button>
      </div>
    </div>

    <div class="section-label">About</div>
    <div class="card fade-up">
      <div class="setting-row">
        <div class="setting-info"><div class="setting-name">PayDay JM</div><div class="setting-desc">Version 2.0 · Built for Jamaican professionals</div></div>
        <span class="pill pill-gold">PWA</span>
      </div>
    </div>
    <button class="btn btn-danger btn-block" style="margin-top:16px;" onclick="resetData()">Reset All Data</button>
  `;
}

// ─── Navigation ──────────────────────────────────────────────
let currentPage = 'dashboard';

const pages = {
  onboarding: { render: renderOnboarding },
  dashboard:  { render: renderDashboard },
  bills:      { render: renderBills },
  spending:   { render: renderSpending },
  goals:      { render: renderGoals },
  settings:   { render: renderSettings },
};

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const nav = document.querySelector('.bottom-nav');
  const header = document.querySelector('.app-header');
  if (nav)    nav.style.display    = page === 'onboarding' ? 'none' : 'flex';
  if (header) header.style.display = page === 'onboarding' ? 'none' : 'flex';

  const content = document.getElementById('page-content');
  content.innerHTML = pages[page] ? pages[page].render() : '';

  const fab = document.getElementById('fab');
  const fabLabel = document.getElementById('fab-label');
  if (fab) {
    const show = ['bills','spending','goals'].includes(page);
    fab.style.display = show ? 'flex' : 'none';
    const fabWrap2 = document.getElementById('fab-wrap');
    if (fabWrap2) fabWrap2.style.display = show ? 'flex' : 'none';
    if (fabLabel) { const labels={bills:'Add Bill',spending:'Log Expense',goals:'New Goal'}; fabLabel.textContent = labels[page]||''; }
  }

  // Animate payday ring
  requestAnimationFrame(() => {
    const fill = document.querySelector('.ring-fill');
    if (fill && fill.dataset.target) setTimeout(() => { fill.style.strokeDashoffset = fill.dataset.target; }, 60);
  });
}

function fabAction() {
  const a = { bills:()=>openModal('modal-bill'), spending:()=>openModal('modal-expense'), goals:()=>openModal('modal-goal') };
  (a[currentPage]||(() => {}))();
}

// ─── Modals ──────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); });
});

// ─── Edit Helpers ────────────────────────────────────────────
function editBill(id) {
  const b = state.bills.find(x=>x.id===id); if (!b) return;
  document.getElementById('bill-name').value   = b.name;
  document.getElementById('bill-icon').value   = b.icon;
  document.getElementById('bill-amount').value = b.amount;
  document.getElementById('bill-due').value    = b.dueDay;
  document.getElementById('bill-freq').value   = b.frequency;
  document.getElementById('bill-edit-id').value= id;
  document.querySelector('#modal-bill .modal-title').textContent = 'Edit Bill';
  openModal('modal-bill');
}
function deleteBill(id) {
  if (!confirm('Delete this bill?')) return;
  state.bills = state.bills.filter(b=>b.id!==id); saveState(); navigate(currentPage); haptic(); toast('Bill deleted','success');
}
function editDebt(id) {
  const d = state.debts.find(x=>x.id===id); if (!d) return;
  document.getElementById('debt-name').value   = d.name;
  document.getElementById('debt-balance').value= d.balance;
  document.getElementById('debt-minpay').value = d.minPayment;
  document.getElementById('debt-rate').value   = d.rate;
  document.getElementById('debt-due').value    = d.dueDay||'';
  document.getElementById('debt-edit-id').value= id;
  document.querySelector('#modal-debt .modal-title').textContent = 'Edit Debt';
  openModal('modal-debt');
}
function deleteDebt(id) {
  if (!confirm('Delete this debt?')) return;
  state.debts = state.debts.filter(d=>d.id!==id); saveState(); navigate(currentPage); haptic(); toast('Debt deleted','success');
}
function editExpense(id) {
  const e = state.expenses.find(x=>x.id===id); if (!e) return;
  document.getElementById('exp-amount').value  = e.amount;
  document.getElementById('exp-cat').value     = e.category;
  document.getElementById('exp-note').value    = e.note||'';
  document.getElementById('exp-date').value    = e.date;
  document.getElementById('exp-edit-id').value = id;
  document.querySelector('#modal-expense .modal-title').textContent = 'Edit Expense';
  openModal('modal-expense');
}
function deleteExpense(id) {
  state.expenses = state.expenses.filter(e=>e.id!==id); saveState(); navigate(currentPage); haptic(); toast('Expense deleted','success');
}
function editGoal(id) {
  const g = state.goals.find(x=>x.id===id); if (!g) return;
  document.getElementById('goal-name').value   = g.name;
  document.getElementById('goal-target').value = g.target;
  document.getElementById('goal-saved').value  = g.saved;
  document.getElementById('goal-date').value   = g.targetDate;
  document.getElementById('goal-icon').value   = g.icon||'🎯';
  document.getElementById('goal-color').value  = g.color||'#c8a96e';
  document.getElementById('goal-edit-id').value= id;
  document.querySelector('#modal-goal .modal-title').textContent = 'Edit Goal';
  openModal('modal-goal');
}

// ─── Data Actions ────────────────────────────────────────────
function togglePaid(id) {
  const b = state.bills.find(x=>x.id===id);
  if (b) { b.paid = !b.paid; haptic(); saveState(); navigate(currentPage); }
}
function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  state.goals = state.goals.filter(g=>g.id!==id); saveState(); navigate(currentPage);
}
function openAddSavingsModal(goalId) {
  document.getElementById('savings-goal-id').value = goalId;
  const goal = state.goals.find(g=>g.id===goalId);
  document.getElementById('savings-modal-title').textContent = `Add Funds — ${goal?.name||''}`;
  openModal('modal-savings');
}

function addBill(e) {
  e.preventDefault();
  const name   = document.getElementById('bill-name').value.trim();
  const amount = parseFloat(document.getElementById('bill-amount').value);
  const dueDay = parseInt(document.getElementById('bill-due').value);
  const icon   = document.getElementById('bill-icon').value||'💳';
  const freq   = document.getElementById('bill-freq').value;
  const editId = document.getElementById('bill-edit-id').value;
  if (!name||!amount||!dueDay) return;
  if (editId) {
    const b = state.bills.find(x=>x.id===editId);
    if (b) { b.name=name; b.amount=amount; b.dueDay=dueDay; b.icon=icon; b.frequency=freq; }
  } else {
    state.bills.push({ id: genId(), name, icon, amount, dueDay, frequency: freq, paid: false, originalAmount: amount });
  }
  saveState(); closeModal('modal-bill');
  document.getElementById('bill-edit-id').value = '';
  document.querySelector('#modal-bill .modal-title').textContent = 'Add Bill';
  navigate(currentPage); haptic(); toast(editId?'Bill updated!':'Bill added!','success');
}

function addExpense(e) {
  e.preventDefault();
  const amount   = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-cat').value;
  const note     = document.getElementById('exp-note').value.trim();
  const date     = document.getElementById('exp-date').value;
  const editId   = document.getElementById('exp-edit-id').value;
  if (!amount||!category) return;
  if (editId) {
    const ex = state.expenses.find(x=>x.id===editId);
    if (ex) { ex.amount=amount; ex.category=category; ex.note=note; ex.date=date; }
  } else {
    state.expenses.push({ id: genId(), amount, category, note, date });
  }
  saveState(); closeModal('modal-expense');
  document.getElementById('exp-edit-id').value = '';
  document.querySelector('#modal-expense .modal-title').textContent = 'Log Expense';
  navigate(currentPage); haptic(); toast(editId?'Expense updated!':'Expense logged!','success');
}

function addGoal(e) {
  e.preventDefault();
  const name       = document.getElementById('goal-name').value.trim();
  const target     = parseFloat(document.getElementById('goal-target').value);
  const saved      = parseFloat(document.getElementById('goal-saved').value)||0;
  const targetDate = document.getElementById('goal-date').value;
  const icon       = document.getElementById('goal-icon').value||'🎯';
  const color      = document.getElementById('goal-color').value||'#c8a96e';
  const editId     = document.getElementById('goal-edit-id').value;
  if (!name||!target||!targetDate) return;
  if (editId) {
    const g = state.goals.find(x=>x.id===editId);
    if (g) { g.name=name; g.target=target; g.saved=saved; g.targetDate=targetDate; g.icon=icon; g.color=color; }
  } else {
    state.goals.push({ id: genId(), name, icon, color, target, saved, targetDate });
  }
  saveState(); closeModal('modal-goal');
  document.getElementById('goal-edit-id').value = '';
  document.querySelector('#modal-goal .modal-title').textContent = 'New Savings Goal';
  navigate(currentPage); haptic(); toast(editId?'Goal updated!':'Goal created!','success');
}

function addSavings(e) {
  e.preventDefault();
  const goalId = document.getElementById('savings-goal-id').value;
  const amount = parseFloat(document.getElementById('savings-amount').value);
  const goal   = state.goals.find(g=>g.id===goalId);
  if (!goal||!amount) return;
  goal.saved = Math.min(goal.target, goal.saved+amount);
  saveState(); closeModal('modal-savings'); navigate(currentPage); haptic(); toast('Savings updated!','success');
}

function addDebt(e) {
  e.preventDefault();
  const name       = document.getElementById('debt-name').value.trim();
  const balance    = parseFloat(document.getElementById('debt-balance').value);
  const minPayment = parseFloat(document.getElementById('debt-minpay').value);
  const rate       = parseFloat(document.getElementById('debt-rate').value)||0;
  const dueDay     = parseInt(document.getElementById('debt-due').value)||1;
  const editId     = document.getElementById('debt-edit-id').value;
  if (!name||!balance||!minPayment) return;
  if (editId) {
    const d = state.debts.find(x=>x.id===editId);
    if (d) { d.name=name; d.balance=balance; d.minPayment=minPayment; d.rate=rate; d.dueDay=dueDay; }
  } else {
    state.debts.push({ id: genId(), name, balance, originalBalance: balance, minPayment, rate, dueDay });
  }
  saveState(); closeModal('modal-debt');
  document.getElementById('debt-edit-id').value = '';
  document.querySelector('#modal-debt .modal-title').textContent = 'Add Debt';
  navigate(currentPage); haptic(); toast(editId?'Debt updated!':'Debt added!','success');
}

function updateSalary(val)         { state.salary = parseFloat(val)||0; saveState(); }
function updateReminderDays(val)   { state.settings.reminderDays = parseInt(val); saveState(); }
function updatePayFrequency(val)   { state.settings.payFrequency = val; saveState(); }

function saveSalaryQuick() {
  const val = parseFloat(document.getElementById('salary-quick-val').value);
  if (val > 0) { state.salary = val; saveState(); }
  closeModal('modal-salary-quick'); navigate(currentPage); haptic(); toast('Salary updated!','success');
}

function toggleNotifications() {
  state.settings.notificationsEnabled = !state.settings.notificationsEnabled;
  if (state.settings.notificationsEnabled && 'Notification' in window) {
    Notification.requestPermission().then(p => { if (p!=='granted') { state.settings.notificationsEnabled=false; saveState(); navigate(currentPage); } });
  }
  saveState(); navigate(currentPage);
}

function resetData() {
  if (confirm('Reset all data? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(defaultState));
    saveState(); navigate('dashboard'); toast('Data reset.','success');
  }
}

// ─── Export CSV ─────────────────────────────────────────────
function exportCSV() {
  const rows = [['Date','Category','Note','Amount (J$)']];
  [...state.expenses].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>rows.push([e.date,e.category,e.note||'',e.amount]));
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `payday-jm-expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); toast('CSV exported!','success');
}

// ─── Alerts Modal ─────────────────────────────────────────────
function checkAlerts() {
  const pd = nextPayday(), days = daysUntil(pd), alerts = billsDueSoon();
  const content = document.getElementById('alerts-content');
  if (content) {
    content.innerHTML = alerts.length
      ? `<div style="color:var(--amber);font-weight:600;margin-bottom:10px;">⚠️ ${alerts.length} bill(s) due soon</div>` +
        alerts.map(b=>`<div class="bill-item" style="padding:10px 0;"><div class="bill-icon">${b.icon}</div><div class="bill-info"><div class="bill-name">${b.name}</div><div class="bill-meta">Due ${b.dueDay}${getDaySuffix(b.dueDay)}</div></div><div class="bill-amount">${formatJMD(b.amount)}</div></div>`).join('')
      : `<div style="color:var(--teal);text-align:center;padding:16px 0;">✅ No bills due in the next ${state.settings.reminderDays} days.<br><br><span style="color:var(--text-dim);font-size:.82rem;">Next payday: ${formatDate(pd)} (${days} days away)</span></div>`;
  }
  openModal('modal-alerts');
}

// ─── Utilities ───────────────────────────────────────────────
function getDaySuffix(d) {
  d = parseInt(d); if (d>=11&&d<=13) return 'th';
  return ['th','st','nd','rd'][d%10]||'th';
}
function getDaysUntilDay(dueDay) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (target <= today) target.setMonth(target.getMonth()+1);
  return Math.round((target-today)/86400000);
}
function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type}`; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 2800);
}
function haptic() { if ('vibrate' in navigator) navigator.vibrate(30); }

// ─── Service Worker ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('/sw.js').catch(()=>{}); });
}

// ─── Init ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const expDate = document.getElementById('exp-date');
  if (expDate) expDate.value = new Date().toISOString().split('T')[0];
  navigate(state.onboardingDone ? 'dashboard' : 'onboarding');
});
