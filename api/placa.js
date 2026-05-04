const https = require('https');

// ─── Rate Limiter nativo (sem dependências) ───────────────────────────────────
const LIMITE = 2;
const JANELA_MS = 24 * 60 * 60 * 1000; // 24 horas

const cache = new Map();

function verificarRateLimit(ip) {
  const agora = Date.now();
  const registro = cache.get(ip);

  if (!registro || agora > registro.expira) {
    cache.set(ip, { count: 1, expira: agora + JANELA_MS });
    return { bloqueado: false, restante: LIMITE - 1 };
  }

  if (registro.count >= LIMITE) {
    return { bloqueado: true, restante: 0 };
  }

  registro.count += 1;
  return { bloqueado: false, restante: LIMITE - registro.count };
}

setInterval(() => {
  const agora = Date.now();
  for (const [ip, registro] of cache.entries()) {
    if (agora > registro.expira) cache.delete(ip);
  }
}, 60 * 60 * 1000);

// ─── IPs bloqueados permanentemente ──────────────────────────────────────────
const IPS_BLOQUEADOS = [
  '35.172.33.10',
  '3.238.143.8',
  '98.92.73.255',
  '54.145.251.119',
  '98.93.89.236',
  '54.82.214.78',
  '174.129.77.116',
  '98.92.73.255',
];

// ─── Handler principal ────────────────────────────────────────────────────────
module.exports = function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Extrair IP real
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown';

  // 2. Bloquear IPs na lista negra
  if (IPS_BLOQUEADOS.includes(ip)) {
    return res.status(403).json({ erro: 'Acesso negado.' });
  }

  // 3. Verificar rate limit
  const { bloqueado, restante } = verificarRateLimit(ip);

  res.setHeader('X-RateLimit-Limit', LIMITE);
  res.setHeader('X-RateLimit-Remaining', restante);

  if (bloqueado) {
    return res.status(429).json({
      erro: 'Limite de consultas atingido. Tente novamente amanhã.',
      limite: LIMITE,
      janela: '24 horas',
    });
  }

  // 4. Sua lógica original da APIPlacas
  const placa = (req.query.placa || '').replace(/\s/g, '').toUpperCase();

  if (placa.length < 7) {
    return res.status(400).json({ erro: 'Placa inválida.' });
  }

  const TOKEN = process.env.APIPLACAS_TOKEN;

  if (!TOKEN) {
    return res.status(500).json({ erro: 'Token não configurado.' });
  }

  const url = `https://wdapi2.com.br/consulta/${placa}/${TOKEN}`;

  https.get(url, function (apiRes) {
    let data = '';
    apiRes.on('data', function (chunk) { data += chunk; });
    apiRes.on('end', function () {
      try {
        const json = JSON.parse(data);
        return res.status(200).json(json);
      } catch (e) {
        return res.status(500).json({ erro: 'Resposta inválida da API.', raw: data.slice(0, 200) });
      }
    });
  }).on('error', function (err) {
    return res.status(500).json({ erro: 'Falha ao chamar API.', detalhe: err.message });
  });
};
