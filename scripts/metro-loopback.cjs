// Temporary development connection. Binds exclusively to this computer.
const net = require('node:net');
const port = Number(process.argv[2] || 8083);
const server = net.createServer((client) => {
  const upstream = net.connect({ host: '::1', port });
  client.pipe(upstream); upstream.pipe(client);
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream.destroy());
});
server.listen(port, '127.0.0.1', () => console.log(`Local Metro bridge ready on 127.0.0.1:${port}`));
server.on('error', (error) => { console.error(error.code); process.exitCode = 1; });
