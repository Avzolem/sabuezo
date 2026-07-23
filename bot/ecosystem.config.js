// Configuración de PM2 para el bot.
// Clave: si index.js sale con código 0 (sesión cerrada por WhatsApp o demasiados
// fallos seguidos), PM2 NO debe reiniciarlo. Sin esto, un 401 se convierte en un
// bucle infinito de reconexiones contra los servidores de WhatsApp.
module.exports = {
  apps: [
    {
      name: 'sabuezo-bot',
      script: 'index.js',
      cwd: __dirname,
      autorestart: true,
      stop_exit_codes: [0],
      exp_backoff_restart_delay: 5000,
      max_restarts: 10,
      min_uptime: 60000,
    },
  ],
};
