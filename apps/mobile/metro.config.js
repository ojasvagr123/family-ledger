const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Dependency backups are recoverable artifacts, not source trees.
config.resolver.blockList = [
  /[/\\]node_modules\.codex-[^/\\]+[/\\].*/,
  /[/\\]android\.codex-stale[/\\].*/,
  /[/\\]\.pnpm-short[/\\].*/,
  /[/\\]\.pnpm-store[/\\].*/,
];
config.maxWorkers = 2;
module.exports = config;
