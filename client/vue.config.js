module.exports = {
  publicPath: process.env.VUE_APP_PUBLIC_PATH || '/',
  devServer: {
    disableHostCheck: true,
    proxy: {
      '/node': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
    },
  },
  productionSourceMap: false,
  configureWebpack: {
    performance: {
      maxEntrypointSize: 1024 * 1000,
      maxAssetSize: 1024 * 1000,
    },
  },
  chainWebpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      config.optimization.minimizer('terser').tap((args) => {
        Object.assign(args[0].terserOptions.compress, {
          warnings: false,
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log'],
        });
        return args;
      });
    }
  },
};
