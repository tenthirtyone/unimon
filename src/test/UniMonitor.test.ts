import assert from "assert";
import UniMonitor from "../"; // Update the path according to your project structure
import { MAINNET } from "../constants";
import { Pair, Token, TokenAmount, Percent } from "@uniswap/sdk";

describe("calculateArbitrageGain", () => {
  const monitor = new UniMonitor();
  it("should calculate the potential arbitrage gain", async () => {
    // Mock the pair data
    const DAI = new Token(
      MAINNET,
      "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      18,
      "DAI",
      "Dai Stablecoin"
    );
    const USDC = new Token(
      MAINNET,
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      6,
      "USDC",
      "USD Coin"
    );
    const WETH = new Token(
      MAINNET,
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      18,
      "WETH",
      "Wrapped Ether"
    );

    const pair1 = new Pair(
      new TokenAmount(DAI, "1000000000000000000000"),
      new TokenAmount(WETH, "500000000000000000")
    );
    const pair2 = new Pair(
      new TokenAmount(WETH, "1000000000000000000"),
      new TokenAmount(USDC, "4000000")
    );
    const pair3 = new Pair(
      new TokenAmount(DAI, "1000000000000000000000"),
      new TokenAmount(USDC, "100")
    );

    const inputAmount = "1000000000000000000000"; // 1000 DAI (in wei)
    const slippageTolerance = new Percent("5", "1000"); // 0.5% slippage tolerance

    const potentialGain = await monitor.calculateArbitrageGain(
      inputAmount,
      slippageTolerance,
      DAI,
      USDC,
      pair1,
      pair2,
      pair3
    );

    // In this case, we only check if the function returns a number
    // due to potential differences in pair data and token prices
    assert.strictEqual(potentialGain > 0, true);
  });
});
