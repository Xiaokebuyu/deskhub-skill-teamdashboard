module.exports = {
  apps: [{
    name: 'deskskill',
    script: 'server/index.js',
    cwd: __dirname,
    node_args: '--experimental-modules',
    env: {
      NODE_ENV: 'production',
    },
    instances: 1,
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
  }],
};
