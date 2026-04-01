const https = require('https');

module.exports = function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
