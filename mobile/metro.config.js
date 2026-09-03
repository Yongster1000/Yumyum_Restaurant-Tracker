const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// On Windows (without Watchman installed), Metro's fallback file watcher
// crashes the whole dev server with ENOENT when it tries to watch
// lightningcss's per-platform optional-dependency folders (darwin/linux/
// freebsd) that npm correctly never creates on this OS. Excluding them from
// the crawl entirely avoids the crash.
// See: node_modules/@expo/metro-file-map/build/watchers/FallbackWatcher.js
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : [existingBlockList]),
  /node_modules[\\/]lightningcss-(darwin|linux|freebsd)[^\\/]*[\\/]/,
];

module.exports = config;
