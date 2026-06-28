const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        if (req.url.startsWith('/proxy/wavespeed')) {
          const CORS_HEADERS = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          };

          if (req.method === 'OPTIONS') {
            res.writeHead(200, CORS_HEADERS);
            res.end();
            return;
          }

          const path = req.url.replace('/proxy/wavespeed', '');
          const upstreamUrl = `https://llm.wavespeed.ai/v1${path}`;

          let body = '';
          req.on('data', (chunk) => { body += chunk.toString(); });
          req.on('end', () => {
            fetch(upstreamUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: req.headers['authorization'] || '',
              },
              body,
            })
              .then((upstream) =>
                upstream.text().then((text) => {
                  res.writeHead(upstream.status, {
                    'Content-Type': 'application/json',
                    ...CORS_HEADERS,
                  });
                  res.end(text);
                })
              )
              .catch((e) => {
                res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
                res.end(JSON.stringify({ error: e.message }));
              });
          });
          return;
        }

        middleware(req, res, next);
      };
    },
  },
};
