require('dotenv').config();
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema',
});
