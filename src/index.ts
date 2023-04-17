import * as dotenv from "dotenv";
dotenv.config();

export default class UniMonitor {
  constructor() {
    const { INFURA_KEY } = process.env;
    if (!INFURA_KEY) {
      console.log("Please set the INFURA_KEY env var in .env");
      return;
    }
  }
  start() {
    console.log("UniMonitor Started");
  }
}

// I do this for nodemon / hot reloading in dev
// $ nodemon src/index.ts
if (require.main === module) {
  const monitor = new UniMonitor();
  monitor.start();
}
