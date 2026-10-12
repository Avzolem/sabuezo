// Configuración de PM2 para el backend (FastAPI).
// Clave: el intérprete es SIEMPRE el Python del venv, con ruta absoluta. Si el
// proceso arranca con el Python del sistema no encuentra las dependencias
// (`No module named 'dotenv'`) y PM2 lo reinicia sin parar.
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'sabuezo-api',
      script: 'main.py',
      cwd: __dirname,
      interpreter: path.join(__dirname, '.venv', 'bin', 'python'),
      autorestart: true,
      // Espera creciente entre reintentos (2 s → 15 s máx.). Sin esto, un fallo
      // de arranque son ~8 reinicios por segundo. No hay tope de reinicios a
      // propósito: con tope, un fallo pasajero al arrancar lo dejaría caído.
      exp_backoff_restart_delay: 2000,
      // Fecha y hora en cada línea del log.
      time: true,
    },
  ],
};
