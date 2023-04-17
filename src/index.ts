import * as dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import {
  MAINNET,
  DAI_ADDRESS,
  USDC_ADDRESS,
  WETH_ADDRESS,
  ONE,
} from "./constants";
import {
  Token,
  Fetcher,
  Pair,
  Route,
  Trade,
  TokenAmount,
  TradeType,
} from "@uniswap/sdk";

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

  async onNewBlock(_block: string) {
    const WETH_DAI = await this.getPairData(WETH, DAI);
    const WETH_USDC = await this.getPairData(WETH, USDC);

    console.log(await this.getPrices(WETH_DAI, WETH));
    console.log(await this.getPrices(WETH_USDC, WETH));
  }

  async getPairData(tokenA: Token, tokenB: Token): Promise<Pair> {
    return await Fetcher.fetchPairData(tokenA, tokenB, this.provider);
  }

  async getPrices(pair: Pair, inputToken: Token) {
    const route = new Route([pair], inputToken);

    const trade = new Trade(
      route,
      new TokenAmount(inputToken, ONE),
      TradeType.EXACT_INPUT
    );

    const executionPrice = trade.executionPrice;
    const nextExecutionPrice = trade.nextMidPrice;

    const slippagePercent =
      ((parseFloat(nextExecutionPrice.toSignificant()) -
        parseFloat(executionPrice.toSignificant())) /
        parseFloat(executionPrice.toSignificant())) *
      100;

    return [
      trade.executionPrice.toSignificant(6),
      trade.executionPrice.invert().toSignificant(6),
      slippagePercent,
    ];
  }
}

// I do this for nodemon / hot reloading in dev
// $ nodemon src/index.ts
if (require.main === module) {
  const monitor = new UniMonitor();
  monitor.start();
}
