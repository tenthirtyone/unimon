import * as dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import { MAINNET, DAI_ADDRESS, USDC_ADDRESS, WETH_ADDRESS } from "./constants";

export default class UniMonitor {
  private provider;
  constructor() {
    const { INFURA_KEY } = process.env;
    if (!INFURA_KEY) {
      console.log("Please set the INFURA_KEY env var in .env");
    }

    this.provider = new ethers.providers.InfuraProvider(MAINNET, INFURA_KEY);

    process.on("SIGINT", () => {
      console.log("Shutting down, removing listeners");
      this.provider.removeListener("block", this.onNewBlock);
    });
  }

  start() {
    console.log("UniMonitor Started");
    this.provider.on("block", this.onNewBlock);
  }

  onNewBlock(block: string) {
    console.log(block);
  }
}

// I do this for nodemon / hot reloading in dev
// $ nodemon src/index.ts
if (require.main === module) {
  const monitor = new UniMonitor();
  monitor.start();
}
