import * as dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import {
  MAINNET,
  DAI_ADDRESS,
  USDC_ADDRESS,
  WETH_ADDRESS,
  ONE,
  TEN,
} from "./constants";
import {
  Token,
  Fetcher,
  Pair,
  Route,
  Trade,
  TokenAmount,
  TradeType,
  Percent,
} from "@uniswap/sdk";

const WETH = new Token(MAINNET, WETH_ADDRESS, 18);
const DAI = new Token(MAINNET, DAI_ADDRESS, 18);
const USDC = new Token(MAINNET, USDC_ADDRESS, 6);

/**
 * This class will monitor the price of WETH -> DAI, WETH -> USDC and DAI -> USDC
 * It can calculate the potential arbitrage opportunities and slippage amount for
 * a given amount (ONE Weth in this example). It will update on every new block.
 *
 * @export
 * @class UniMonitor
 * @typedef {UniMonitor}
 */
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

  /**
   * Starts the UniMonitor.
   */
  start() {
    console.log("UniMonitor Started");
    this.provider.on("block", this.onNewBlock);
  }

  /**
   * Called when a new block is mined.
   * @param {string} _block - The block number as a string.
   */
  async onNewBlock(_block: string) {
    const WETH_DAI = await this.getPairData(WETH, DAI);
    const WETH_USDC = await this.getPairData(WETH, USDC);
    const DAI_USDC = await this.getPairData(DAI, USDC);

    const [WETH_DAI_PRICE] = await this.getPrices(WETH_DAI, WETH);
    const [WETH_USDC_PRICE] = await this.getPrices(WETH_USDC, WETH);

    const slippageTolerance = new Percent("5", "1000"); // 0.5% slippage tolerance

    const potentialGain = await this.calculateArbitrageGain(
      ONE,
      slippageTolerance,
      DAI,
      USDC,
      WETH_DAI,
      WETH_USDC,
      DAI_USDC
    );

    console.log(`The price of WETH in DAI is: $${WETH_DAI_PRICE}`);
    console.log(`The price of WETH in USDC is: $${WETH_USDC_PRICE}`);
    console.log(
      `Potential arbitrage gain for ONE WETH from DAI to USDC is : ${potentialGain}`
    );
  }

  /**
   * Fetches pair data for two tokens from Uniswap.
   * @param {Token} tokenA - The first token in the pair.
   * @param {Token} tokenB - The second token in the pair.
   * @returns {Promise<Pair>} A promise that resolves to a Pair instance representing the token pair.
   */
  async getPairData(tokenA: Token, tokenB: Token): Promise<Pair> {
    return await Fetcher.fetchPairData(tokenA, tokenB, this.provider);
  }

  /**
   * Calculates the current prices of a token against another token in a Uniswap pair.
   * @param {Pair} pair - The Uniswap pair.
   * @param {Token} inputToken - The input token for the trade.
   * @returns {Promise<[string, string, number]>} A promise that resolves to an array containing the execution price, inverted execution price, and slippage percentage.
   */
  async getPrices(pair: Pair, inputToken: Token) {
    const route = new Route([pair], inputToken);

    const trade = new Trade(
      route,
      new TokenAmount(inputToken, TEN),
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

  /**
   * Calculates the potential arbitrage gain between two Uniswap pairs.
   * @async
   * @param {string} inputAmount - The amount of the input token to trade.
   * @param {Percent} slippageTolerance - The maximum slippage tolerance for the trade.
   * @param {Token} inputToken - The input token for the trade.
   * @param {Token} outputToken - The output token for the trade.
   * @param {Pair} pair1 - The first Uniswap pair.
   * @param {Pair} pair2 - The second Uniswap pair.
   * @param {Pair} pair3 - The third Uniswap pair.
   * @returns {Promise<number>} A promise that resolves to the potential arbitrage gain as a number.
   */
  async calculateArbitrageGain(
    inputAmount: string,
    slippageTolerance: Percent,
    inputToken: Token,
    outputToken: Token,
    pair1: Pair,
    pair2: Pair,
    pair3: Pair
  ) {
    const directRoute = new Route([pair3], inputToken, outputToken);
    const indirectRoute = new Route([pair1, pair2], inputToken, outputToken);

    const directTrade = new Trade(
      directRoute,
      new TokenAmount(inputToken, inputAmount),
      TradeType.EXACT_INPUT
    );
    const indirectTrade = new Trade(
      indirectRoute,
      new TokenAmount(inputToken, inputAmount),
      TradeType.EXACT_INPUT
    );

    const directAmountOut = directTrade.minimumAmountOut(slippageTolerance);
    const indirectAmountOut = indirectTrade.minimumAmountOut(slippageTolerance);

    const potentialGain =
      parseFloat(indirectAmountOut.toSignificant()) -
      parseFloat(directAmountOut.toSignificant());
    return potentialGain;
  }
}

// I do this for nodemon / hot reloading in dev
// $ nodemon src/index.ts
if (require.main === module) {
  const monitor = new UniMonitor();
  monitor.start();
}
