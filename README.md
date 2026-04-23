# PayDay JM — Personal Budget App

A **Progressive Web App (PWA)** for Jamaican salaried professionals to manage bills, track spending, and hit savings goals — with accurate payday calculation built around Jamaican banking rules.

---

## ✨ Features

### 🗓️ Smart Payday Calculator
Calculates your actual payday based on the 25th — automatically adjusted for:
- Weekends (Saturday → Friday 24th, Sunday → Friday 23rd)
- All official Jamaican public holidays
- Combined weekend + holiday clashes

Holidays included: New Year's, Ash Wednesday, Good Friday, Easter Monday, Labour Day, Emancipation Day, Independence Day, National Heroes' Day, Christmas, Boxing Day.

### 📋 Bills & Debt Manager
- Track recurring bills with due dates, amounts, and frequencies
- Log debts with balance, interest rate, and minimum payments
- Mark bills as paid each month
- Estimated debt payoff timelines

### 📊 Spending Categories & Reports
- Log expenses by category (Groceries, Transport, Dining, etc.)
- Visual donut chart breakdown
- Set per-category spending limits with overspend alerts
- Month-over-month tracking

### 🎯 Savings Goals
- Create named goals with target amounts and dates
- Auto-calculates how much to set aside per paycheck
- Visual progress bars per goal
- Multiple simultaneous goals

### 🏠 Home Dashboard
Single-screen overview of:
- Available balance this pay period
- Days until next payday (animated ring)
- Next bill due
- Top savings goal progress
- Total debt remaining

---

## 🚀 Deploy to GitHub Pages

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit — PayDay JM PWA"
git remote add origin https://github.com/YOUR_USERNAME/payday-jm.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from branch**
3. Branch: `main` / `root`
4. Click **Save**

Your app will be live at: `https://YOUR_USERNAME.github.io/payday-jm/`

### Step 3 — Install as PWA
On Android:
- Open Chrome → visit your URL → tap **⋮ menu** → **Add to Home screen**

On iPhone:
- Open Safari → visit your URL → tap **Share** → **Add to Home Screen**

---

## 📁 Project Structure

```
payday-jm/
├── index.html       # App shell + all modals
├── style.css        # Full stylesheet (dark luxury theme)
├── app.js           # All logic: payday calc, state, rendering
├── sw.js            # Service worker (offline support + push notifications)
├── manifest.json    # PWA manifest
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## 🇯🇲 Locale Settings

| Setting | Value |
|---|---|
| Currency | Jamaican Dollar (JMD, J$) |
| Date format | DD/MM/YYYY |
| Timezone | UTC−5 (Jamaica does not observe DST) |
| Language | English |

---

## 🛠️ Tech Stack

- **Vanilla JS** — no frameworks, no build step required
- **CSS custom properties** — full design token system
- **Service Worker** — offline-first, installable
- **localStorage** — all data persists on-device
- **Web Push API** — bill reminders (requires HTTPS)

---

## 🗺️ Roadmap (Phase 2)

- [ ] Bank account sync / transaction import
- [ ] Debt payoff calculator (avalanche vs snowball)
- [ ] "Safe to spend" number
- [ ] PDF / CSV export
- [ ] Annual holiday list auto-update via API

---

## 📄 License

MIT — free to use and modify.
