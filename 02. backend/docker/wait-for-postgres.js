const net = require('net');

const host = process.env.DATABASE_HOST || 'localhost';
const port = parseInt(process.env.DATABASE_PORT || '5432', 10);
const maxAttempts = 30;
const delayMs = 2000;

function tryConnect(attempt) {
  const socket = net.connect(port, host);

  socket.once('connect', () => {
    socket.end();
    console.log(`PostgreSQL is reachable at ${host}:${port}`);
    process.exit(0);
  });

  socket.once('error', () => {
    socket.destroy();
    if (attempt >= maxAttempts) {
      console.error(`Timed out waiting for PostgreSQL at ${host}:${port}`);
      process.exit(1);
    }
    console.log(`Waiting for PostgreSQL at ${host}:${port} (attempt ${attempt}/${maxAttempts})...`);
    setTimeout(() => tryConnect(attempt + 1), delayMs);
  });
}

tryConnect(1);
