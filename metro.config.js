const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = config.resolver.sourceExts.filter((extension) => extension !== "glb");
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, "glb"]));

// react-native-maps is native-only: swap in a placeholder for the web (Vercel) build.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return { type: "sourceFile", filePath: path.join(__dirname, "src/lib/maps.web.tsx") };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
