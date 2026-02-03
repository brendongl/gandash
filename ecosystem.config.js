module.exports = {
  apps: [{
    name: 'dash-pkm',
    script: './backend/index.js',
    cwd: '/home/brendongl/projects/dashbored',
    env: {
      PORT: 3002,
      NOCODB_URL: 'http://localhost:8080',
      NOCODB_TOKEN: 'Lu4XzHtqJZ4HTRbOELjMIAIiuON2Swc-MpJsmy1j',
      NOCODB_BASE_ID: 'ptkjq1nepc4u0re',
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1465902062704881746/J8TILh2k_mTPdQgxE7FQUU-xVJPOJZCZFpemZ_a_TL48gZ0LRrXf9-9x_PxCj0rOLDhR'
    },
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M'
  }]
};
