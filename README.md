# UNO CHAOS — Deploy Guide

## 📁 Struktur Project

```
uno-chaos/
├── index.html          ← Frontend utama
├── style.css           ← Styling
├── game.js             ← Game logic (local)
├── setup.js            ← Setup screen
├── lobby.js            ← Online lobby logic
│
└── server/             ← Backend (Node.js)
    ├── server.js           ← Express + Socket.io
    ├── gameLogic.js        ← UNO logic server-side
    └── package.json
```

---

## 🚀 Cara Deploy ke Railway (GRATIS)

### Step 1 — Push ke GitHub

```bash
# Di folder uno-chaos/server
cd server
git init
git add .
git commit -m "uno chaos server"

# Buat repo baru di github.com/new
# Lalu:
git remote add origin https://github.com/USERNAME/uno-chaos-server.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy di Railway

1. Buka **railway.app** → Login dengan GitHub
2. Klik **New Project** → **Deploy from GitHub repo**
3. Pilih repo `uno-chaos-server`
4. Railway auto-detect Node.js dan jalankan `npm start`
5. Tunggu deploy selesai (1–2 menit)
6. Klik domain yang dikasih Railway → copy URL-nya
   contoh: `https://uno-chaos-server-production.up.railway.app`

### Step 3 — Update SERVER_URL di Frontend

Buka `lobby.js`, line 13:
```js
const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : window.location.origin;  // ← Railway serve frontend + backend dari 1 domain
```

Karena Railway serve semua dari 1 domain, ini udah auto benar.

### Step 4 — Deploy Frontend

**Opsi A: Vercel (recommended)**
1. Push seluruh folder `uno-chaos/` ke GitHub (bukan cuma server)
2. Buka **vercel.com** → Import repo
3. Framework: **Other** (static)
4. Root directory: `/` (root)
5. Deploy!

Tapi ada masalah: frontend dan backend beda domain = CORS issue.

**Opsi B: Serve dari Railway (paling simpel ✅)**

Server.js sudah serve static files:
```js
app.use(express.static(path.join(__dirname, '..')));
```

Jadi taruh semua file frontend di folder parent server (`uno-chaos/`), push semua ke GitHub, deploy server ke Railway — Railway serve frontend + backend dari 1 URL!

**Struktur repo untuk Railway:**
```
repo-root/
├── index.html       ← frontend
├── style.css
├── game.js
├── setup.js
├── lobby.js
├── package.json     ← server/package.json (pindah ke root)
├── server.js        ← server/server.js (pindah ke root)
└── gameLogic.js     ← server/gameLogic.js (pindah ke root)
```

---

## 💻 Cara Jalankan Lokal

```bash
cd server
npm install
npm run dev     # pakai nodemon (auto-restart)
# atau
npm start       # production mode
```

Buka browser: `http://localhost:3000`

---

## 🔧 Environment Variables (Railway)

| Key | Value |
|---|---|
| `PORT` | Auto-set oleh Railway |
| `NODE_ENV` | `production` |

---

## 🐛 Common Issues

| Problem | Fix |
|---|---|
| `CORS error` | Pastikan frontend dan backend 1 domain (Railway serve keduanya) |
| `Socket not connecting` | Cek URL di `lobby.js` → `SERVER_URL` |
| `Module not found` | `npm install` dulu di folder server |
| Railway deploy gagal | Pastikan `package.json` ada di root repo |
