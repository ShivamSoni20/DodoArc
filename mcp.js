const { startMcpServer } = require('./src/mcp/server');

startMcpServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
