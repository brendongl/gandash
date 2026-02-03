module.exports = {
  apps: [{
    name: 'gandash',
    script: 'backend/index.js',
    cwd: '/home/brendongl/projects/gandash',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: '/home/brendongl/.pm2/logs/gandash-error.log',
    out_file: '/home/brendongl/.pm2/logs/gandash-out.log',
    time: true
  }]
};
