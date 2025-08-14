module.exports = {
  apps: [
    {
      name: 'sms',
      script: './server.js',
      env: {
        NODE_ENV: 'production',
        
      },
    },
  ],
};
