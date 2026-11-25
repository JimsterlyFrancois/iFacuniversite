import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ht.edu.ifac.universite",
  appName: "iFac Université",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
