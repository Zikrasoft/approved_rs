module.exports = {
  hooks: {
    allowBuild(pkg) {
      return ['esbuild', 'sharp', '@parcel/watcher'].includes(pkg.name);
    },
  },
};
