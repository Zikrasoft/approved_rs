module.exports = {
  hooks: {
    allowBuild(pkg) {
      return [
        'esbuild',
        'sharp',
        '@parcel/watcher',
        '@swc/core',
        'msgpackr-extract',
        'protobufjs',
      ].includes(pkg.name);
    },
  },
};
