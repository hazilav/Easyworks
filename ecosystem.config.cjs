module.exports = {
  apps: [
    {
      name: 'easyworks-production',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1024M',
      // Exponential backoff restart delay to prevent aggressive restart loops on startup crashes
      exp_backoff_restart_delay: 200,
      min_uptime: '5000ms',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      combine_logs: true,
    },
  ],
};
