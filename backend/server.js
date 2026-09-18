
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
        model: 'qwen/qwen3.8-27b',
        response_format: { type: 'json_object' },
        reasoning_effort: 'none',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse cette photo de repas. Reponds UNIQUEMENT en JSON valide avec ce format exact : {"aliments":["nom1","nom2"],"kcal":nombre,"proteines":nombre,"glucides":nombre,"lipides":nombre,"confiance":"haute|moyenne|basse","composition":{"proteines_pct":nombre,"feculents_pct":nombre,"legumes_pct":nombre}}. Les valeurs nutritionnelles sont des estimations pour la portion visible entiere. Pour composition, estime la part visuelle approximative de l\'assiette occupee par les proteines, les feculents et les legumes/fruits (les 3 pourcentages doivent totaliser environ 100).' },
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
 
// ══════════════════════════════════════════════════════
//  7. CHATBOT NAVIGATION
//  POST /chat
//  Body: { message: string, history: [{role, content}, ...] (optionnel) }
//  Retourne : { reply: string }
// ══════════════════════════════════════════════════════
const PLATEFORME_INFO = `
PAGES DE LA PLATEFORME :
- index.html : inscription en 4 etapes (Compte, Profil, Sante, Energie)
- mon-espace.html : tableau de bord apres connexion (Mon Espace)
- historique.html : historique IMC + calculateur de repas (reserve aux abonnes)
- paiement.html : page d'abonnement
 
MENU (icone en haut a gauche sur Mon Espace) :
- Mon Espace : retour au tableau de bord
- Modifier mon profil : mettre a jour poids, taille, niveau d'activite
- Mon plan equilibre : recommandations alimentaires personnalisees
- Historique & Calculateur : suivi de l'IMC dans le temps + calcul manuel de repas (reserve aux abonnes)
- Scanner de repas : photo d'assiette -> estimation calories/macros (reserve aux abonnes)
- Nos rubriques : contenu educatif (Gastronomie Egyptienne, Science/Microbiote, Prophylaxie alimentaire, Question du departement sante)
- Sources fiables : liens vers des references scientifiques (OMS, ANSES...)
- Mon abonnement : gerer l'abonnement
- Deconnexion
 
TABLEAU DE BORD affiche : groupe sanguin, IMC calcule automatiquement, besoins caloriques par jour, bouton Modifier mon profil, banniere Mon plan equilibre.
 
SCANNER DE REPAS (etapes) : ouvrir depuis le menu -> ajouter une photo -> cliquer Analyser le repas -> resultats affiches (kcal, proteines/glucides/lipides, aliments detectes, pourcentage des besoins caloriques quotidiens, comparatif visuel entre la composition de l'assiette et une assiette equilibree recommandee). Si le service n'a pas ete utilise depuis un moment, la premiere analyse peut prendre jusqu'a une minute : c'est normal, pas un bug.
 
ABONNEMENT : gratuit = profil, tableau de bord, plan alimentaire, rubriques, sources fiables. Reserve aux abonnes = Scanner de repas et Historique & Calculateur. Activation depuis le menu > Mon abonnement.
`;
 
const CHAT_SYSTEM_PROMPT = "Tu es l'assistant d'aide a la navigation de la plateforme Hebdo Sante Usenghor, une plateforme de nutrition pour les etudiants de l'Universite Senghor. Ton seul role est d'aider les utilisateurs a trouver une fonctionnalite, comprendre une section, ou resoudre un souci d'usage courant. Reponds UNIQUEMENT a partir des informations fournies ci-dessous sur la plateforme. N'invente jamais une fonctionnalite, une page ou une option qui n'y figure pas. Si la question sort de ce perimetre (question medicale personnelle, sujet sans rapport avec la plateforme), dis clairement que tu ne peux pas y repondre et invite a contacter le support. Reponds de maniere courte, claire et directe, en francais.\n\n" + PLATEFORME_INFO;
 
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'message requis' });
 
    const messages = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history.slice(-6) : []),
      { role: 'user', content: message }
    ];
 
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        reasoning_effort: 'none',
        messages: messages,
        max_tokens: 400
      })
    });
 
    const data = await groqRes.json();
    if (data.error) return res.status(502).json({ error: data.error.message || 'Erreur API Groq' });
 
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    res.json({ reply: reply.trim() });
 
  } catch (err) {
    console.error('chat error:', err.message);
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
  console.log(`   POST /chat`);
});
 
