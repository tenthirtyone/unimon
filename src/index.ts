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
import { TradingMonitor } from "./trading-monitor";

async function main() {
  const provider = new ethers.providers.AlchemyProvider(
    MAINNET,
    process.env.ALCHEMY_API_KEY
  );

  const WETH = new Token(
    MAINNET,
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    18,
    "WETH"
  );
  const USDC = new Token(
    MAINNET,
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    6,
    "USDC"
  );

  const monitor = new TradingMonitor(provider, process.env.PRIVATE_KEY!, {
    maxSlippage: 0.5, // 0.5%
    minProfitThreshold: 0.1, // 0.1 ETH
    maxGasPrice: 100, // 100 gwei
  });

  // Start monitoring with 1 WETH
  const oneWeth = new TokenAmount(
    WETH,
    ethers.utils.parseEther("1").toString()
  );
  await monitor.start(WETH, oneWeth);

  // Handle shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await monitor.stop();
    process.exit();
  });
}

main().catch(console.error);
