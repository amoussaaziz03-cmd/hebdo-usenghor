// ═══════════════════════════════════════════════════════
//  HEBDO SANTE USENGHOR — Backend
//  Gestion abonnements via Google Sheets
//  Node.js + Express
// ═══════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();
const PORT    = process.env.PORT || 3000;

const SHEETS_URL  = process.env.SHEETS_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'usenghor-admin-2024';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '12mb' }));

// ── Santé ──
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'HEBDO SANTE USENGHOR Backend' });
});

// ══════════════════════════════════════════════════════
//  1. VÉRIFIER ABONNEMENT
//  GET /check?ident=xxx
//  Retourne : { actif, type, joursRestants, expiration }
// ══════════════════════════════════════════════════════
app.get('/check', async (req, res) => {
  try {
    const { ident } = req.query;
    if (!ident) return res.status(400).json({ error: 'ident requis' });

    const url = `${SHEETS_URL}?action=check_abonnement&ident=${encodeURIComponent(ident)}`;
    const r   = await fetch(url);
    const data = await r.json();

    if (data.status !== 'ok') return res.json({ actif: false, type: 'none' });

    const abo = data.abonnement;
    if (!abo) return res.json({ actif: false, type: 'none' });

    // VIP = toujours actif
    if (abo.type === 'vip') return res.json({ actif: true, type: 'vip', joursRestants: null });

    // Vérifier expiration
    const expiration = new Date(abo.expiration);
    const now        = new Date();
    const actif      = expiration > now;
    const joursRestants = actif ? Math.ceil((expiration - now) / (1000*60*60*24)) : 0;

    res.json({ actif, type: abo.type, joursRestants, expiration: abo.expiration });

  } catch (err) {
    console.error('check error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  2. ACTIVER ABONNEMENT (admin uniquement)
//  POST /activer
//  Body: { ident, type, duree_jours, token }
//  type: 'trial' | 'actif' | 'vip'
// ══════════════════════════════════════════════════════
app.post('/activer', async (req, res) => {
  try {
    const { ident, type, duree_jours, token } = req.body;

    // Sécurité — token admin requis
    if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Token invalide' });
    if (!ident || !type)       return res.status(400).json({ error: 'ident et type requis' });

    const expiration = type === 'vip'
      ? null
      : new Date(Date.now() + (duree_jours || 30) * 24*60*60*1000).toISOString();

    const url = `${SHEETS_URL}?action=activer_abonnement&ident=${encodeURIComponent(ident)}&type=${encodeURIComponent(type)}&expiration=${encodeURIComponent(expiration || 'illimite')}`;
    const r   = await fetch(url);
    const data = await r.json();

    res.json({ status: 'ok', ident, type, expiration, sheets: data });

  } catch (err) {
    console.error('activer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  3. ACTIVER CODE PROMO
//  POST /promo
//  Body: { ident, code }
// ══════════════════════════════════════════════════════
app.post('/promo', async (req, res) => {
  try {
    const { ident, code } = req.body;
    if (!ident || !code) return res.status(400).json({ error: 'ident et code requis' });

    // Codes VIP définis côté serveur (secrets)
    const CODES_VIP = (process.env.CODES_VIP || 'USENGHOR2024,VIPACCES,FONDATEUR').split(',');

    if (CODES_VIP.includes(code.trim().toUpperCase())) {
      // Activer VIP dans Sheets
      const url = `${SHEETS_URL}?action=activer_abonnement&ident=${encodeURIComponent(ident)}&type=vip&expiration=illimite&code=${encodeURIComponent(code)}`;
      await fetch(url);
      return res.json({ status: 'ok', type: 'vip', message: 'Acces VIP active' });
    }

    // Vérifier si c'est un code essai
    const CODES_TRIAL = (process.env.CODES_TRIAL || '').split(',').filter(Boolean);
    if (CODES_TRIAL.includes(code.trim().toUpperCase())) {
      const expiration = new Date(Date.now() + 30*24*60*60*1000).toISOString();
      const url = `${SHEETS_URL}?action=activer_abonnement&ident=${encodeURIComponent(ident)}&type=trial&expiration=${encodeURIComponent(expiration)}&code=${encodeURIComponent(code)}`;
      await fetch(url);
      return res.json({ status: 'ok', type: 'trial', expiration, message: 'Essai 30 jours active' });
    }

    res.json({ status: 'invalide', message: 'Code invalide' });

  } catch (err) {
    console.error('promo error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  4. DÉMARRER ESSAI GRATUIT
//  POST /essai
//  Body: { ident, email, nom }
// ══════════════════════════════════════════════════════
app.post('/essai', async (req, res) => {
  try {
    const { ident, email, nom } = req.body;
    if (!ident || !email) return res.status(400).json({ error: 'ident et email requis' });

    const expiration = new Date(Date.now() + 30*24*60*60*1000).toISOString();
    const url = `${SHEETS_URL}?action=activer_abonnement&ident=${encodeURIComponent(ident)}&type=trial&expiration=${encodeURIComponent(expiration)}&email=${encodeURIComponent(email)}&nom=${encodeURIComponent(nom||'')}`;
    const r   = await fetch(url);
    const data = await r.json();

    res.json({ status: 'ok', type: 'trial', expiration, joursRestants: 30, sheets: data });

  } catch (err) {
    console.error('essai error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  5. LISTE ABONNÉS (admin)
//  GET /abonnes?token=xxx
// ══════════════════════════════════════════════════════
app.get('/abonnes', async (req, res) => {
  try {
    if (req.query.token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Token invalide' });

    const url  = `${SHEETS_URL}?action=liste_abonnes`;
    const r    = await fetch(url);
    const data = await r.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  6. SCANNER DE REPAS (analyse photo)
//  POST /scan-repas
//  Body: { image: 'data:image/jpeg;base64,...' }
//  Retourne : { aliments, kcal, proteines, glucides, lipides, confiance }
//  Necessite la variable d'environnement GROQ_API_KEY (gratuite sur console.groq.com)
// ══════════════════════════════════════════════════════
app.post('/scan-repas', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'image requise' });

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'format image invalide' });
    const mediaType  = match[1];
    const base64Data = match[2];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        response_format: { type: 'json_object' },
        reasoning_effort: 'none',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse cette photo de repas. Reponds UNIQUEMENT en JSON valide avec ce format exact : {"aliments":["nom1","nom2"],"kcal":nombre,"proteines":nombre,"glucides":nombre,"lipides":nombre,"confiance":"haute|moyenne|basse"}. Les valeurs nutritionnelles sont des estimations pour la portion visible entiere.' },
            { type: 'image_url', image_url: { url: 'data:' + mediaType + ';base64,' + base64Data } }
          ]
        }]
      })
    });

    const data = await groqRes.json();
    if (data.error) return res.status(502).json({ error: data.error.message || 'Erreur API Groq' });

    const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return res.status(502).json({ error: 'Reponse IA non-analysable' }); }

    res.json(parsed);

  } catch (err) {
    console.error('scan-repas error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur USENGHOR démarré sur le port ${PORT}`);
  console.log(`📋 Routes disponibles :`);
  console.log(`   GET  /check?ident=xxx`);
  console.log(`   POST /essai`);
  console.log(`   POST /promo`);
  console.log(`   POST /activer  (admin)`);
  console.log(`   GET  /abonnes  (admin)`);
  console.log(`   POST /scan-repas`);
});
