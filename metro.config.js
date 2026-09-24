const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = config.resolver.sourceExts.filter((extension) => extension !== "glb");
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, "glb"]));

module.exports = config;
