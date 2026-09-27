// Entry point. Vercel imports the exported app; locally we listen on PORT.
const app = require('./src/app');
const config = require('./src/config');

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Zenith API listening on http://localhost:${config.port}`);
  });
}

module.exports = app;
