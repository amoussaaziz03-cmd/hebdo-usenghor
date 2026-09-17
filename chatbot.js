(function() {
  var BACKEND_URL = 'https://hebdo-usenghor.onrender.com';
  var history = [];

  var css = "#hs-chat-bubble{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:#003D8A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:9999;border:none}"
    + "#hs-chat-window{position:fixed;bottom:88px;right:20px;width:320px;max-width:90vw;height:440px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:9999;font-family:'DM Sans',sans-serif}"
    + "#hs-chat-window.show{display:flex}"
    + "#hs-chat-head{background:#003D8A;color:#fff;padding:14px 16px;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}"
    + "#hs-chat-close{cursor:pointer;background:rgba(255,255,255,.15);border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center}"
    + "#hs-chat-body{flex:1;overflow-y:auto;padding:12px;background:#F4F7FB}"
    + ".hs-msg{max-width:80%;padding:9px 12px;border-radius:12px;margin-bottom:8px;font-size:13px;line-height:1.4;word-wrap:break-word}"
    + ".hs-msg.user{background:#003D8A;color:#fff;margin-left:auto;border-bottom-right-radius:3px}"
    + ".hs-msg.bot{background:#fff;color:#1A1A2E;box-shadow:0 1px 4px rgba(0,0,0,.08);border-bottom-left-radius:3px}"
    + "#hs-chat-input-row{display:flex;border-top:1px solid #eee;padding:8px;flex-shrink:0}"
    + "#hs-chat-input{flex:1;border:1px solid #d1d5db;border-radius:20px;padding:8px 14px;font-size:13px;outline:none;font-family:'DM Sans',sans-serif}"
    + "#hs-chat-send{background:#003D8A;color:#fff;border:none;border-radius:50%;width:36px;height:36px;margin-left:6px;cursor:pointer;flex-shrink:0}";

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var html = '<button id="hs-chat-bubble" aria-label="Ouvrir l\'assistant">\uD83D\uDCAC</button>'
    + '<div id="hs-chat-window">'
    + '  <div id="hs-chat-head"><span>Assistant Hebdo Sante</span><span id="hs-chat-close">\u2715</span></div>'
    + '  <div id="hs-chat-body"><div class="hs-msg bot">Bonjour ! Je peux vous aider a naviguer sur la plateforme (inscription, scanner, abonnement...). Que cherchez-vous ?</div></div>'
    + '  <div id="hs-chat-input-row">'
    + '    <input id="hs-chat-input" type="text" placeholder="Posez votre question...">'
    + '    <button id="hs-chat-send" aria-label="Envoyer">\u2192</button>'
    + '  </div>'
    + '</div>';

  function init() {
    document.body.insertAdjacentHTML('beforeend', html);

    var bubble = document.getElementById('hs-chat-bubble');
    var win = document.getElementById('hs-chat-window');
    var body = document.getElementById('hs-chat-body');
    var input = document.getElementById('hs-chat-input');

    bubble.addEventListener('click', function() { win.classList.toggle('show'); if (win.classList.contains('show')) input.focus(); });
    document.getElementById('hs-chat-close').addEventListener('click', function() { win.classList.remove('show'); });

    function addMsg(text, who) {
      var d = document.createElement('div');
      d.className = 'hs-msg ' + who;
      d.textContent = text;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      return d;
    }

    function send() {
      var msg = input.value.trim();
      if (!msg) return;
      addMsg(msg, 'user');
      history.push({ role: 'user', content: msg });
      input.value = '';
      var loadingEl = addMsg('...', 'bot');

      fetch(BACKEND_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(-6) })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        loadingEl.remove();
        var reply = data.reply || (data.error ? 'Erreur : ' + data.error : 'Reponse indisponible pour le moment.');
        addMsg(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function() {
        loadingEl.remove();
        addMsg('Connexion impossible. Verifiez votre reseau et reessayez.', 'bot');
      });
    }

    document.getElementById('hs-chat-send').addEventListener('click', send);
    input.addEventListener('keypress', function(e) { if (e.key === 'Enter') send(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
