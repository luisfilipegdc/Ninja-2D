module.exports = {
  apps: [
    {
      name: "mapa",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/festajuninamarista",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
