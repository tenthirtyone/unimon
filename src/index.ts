import * as dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import { MAINNET, DAI_ADDRESS, USDC_ADDRESS, WETH_ADDRESS } from "./constants";
import { Token, Fetcher } from "@uniswap/sdk";

const WETH = new Token(MAINNET, WETH_ADDRESS, 18);
const DAI = new Token(MAINNET, DAI_ADDRESS, 18);
const USDC = new Token(MAINNET, USDC_ADDRESS, 6);

export default class UniMonitor {
  private provider;

  constructor() {
    const { INFURA_KEY } = process.env;
    if (!INFURA_KEY) {
      console.log("Please set the INFURA_KEY env var in .env");
    }

    this.provider = new ethers.providers.InfuraProvider(MAINNET, INFURA_KEY);
    this.onNewBlock = this.onNewBlock.bind(this);

    process.on("SIGINT", () => {
      console.log("Shutting down, removing listeners");
      this.provider.removeListener("block", this.onNewBlock);
    });
  }

  start() {
    console.log("UniMonitor Started");
    this.provider.on("block", this.onNewBlock);
  }

  async onNewBlock(block: string) {
    console.log(block);
    const WETH_DAI = await this.getPairData(WETH, DAI);
    const WETH_USDC = await this.getPairData(WETH, USDC);

    console.log(WETH_DAI);
    console.log(WETH_USDC);
  }

  async getPairData(tokenA: Token, tokenB: Token) {
    return await Fetcher.fetchPairData(tokenA, tokenB, this.provider);
  }
}

// I do this for nodemon / hot reloading in dev
// $ nodemon src/index.ts
if (require.main === module) {
  const monitor = new UniMonitor();
  monitor.start();
}
