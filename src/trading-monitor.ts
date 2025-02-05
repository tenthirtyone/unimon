import { ethers } from "ethers";
import { Token, Pair, TokenAmount } from "@uniswap/sdk";
import { PriceMonitorService } from "./services/price-monitor.service";
import { PathFinderService } from "./services/path-finder.service";
import { ArbitrageCalculatorService } from "./services/arbitrage-calculator.service";
import { TradeExecutorService } from "./services/trade-executor.service";
import { TokenManager } from "./token-manager";
import { ChainId } from "@uniswap/sdk";
import { TokenConfig } from "./types";
import { MAINNET_TOKENS } from "./constants";

export class TradingMonitor {
  private tokenManager: TokenManager;
  private priceMonitor: PriceMonitorService;
  private arbitrageCalculator: ArbitrageCalculatorService;
  private tradeExecutor: TradeExecutorService;
  private pathFinder: PathFinderService;
  private logger: any; // Will inherit from BaseService later

  constructor(
    provider: ethers.providers.BaseProvider,
    privateKey: string,
    tradingConfig: any, // We'll type this properly later
    chainId: ChainId = ChainId.MAINNET
  ) {
    this.tokenManager = new TokenManager(chainId);
    this.priceMonitor = new PriceMonitorService(provider);
    this.arbitrageCalculator = new ArbitrageCalculatorService(
      provider,
      tradingConfig
    );
    this.pathFinder = new PathFinderService(provider);
    this.tradeExecutor = new TradeExecutorService(provider, privateKey);
    this.logger = this.priceMonitor.getLogger();
  }

  async initialize(tokenConfigs: Record<string, TokenConfig>) {
    // Initialize all tokens
    Object.values(tokenConfigs).forEach((config) => {
      this.tokenManager.addToken(config);
    });

    // Setup monitoring for all pairs
    const pairs = this.tokenManager.getAllPairs();
    for (const [tokenA, tokenB] of pairs) {
      const pair = await this.priceMonitor.addPair(tokenA, tokenB);
      this.pathFinder.addPair(pair, `${tokenA.symbol}:${tokenB.symbol}`);
      this.logger.info(
        {
          tokenA: tokenA.symbol,
          tokenB: tokenB.symbol,
        },
        "Monitoring pair"
      );
    }
  }

  async start(baseToken: Token, initialAmount: TokenAmount) {
    try {
      await this.initialize(MAINNET_TOKENS);

      // Start all services
      await this.priceMonitor.start();
      await this.arbitrageCalculator.start();
      await this.tradeExecutor.start();

      this.logger.info(
        {
          baseToken: baseToken.symbol,
          amount: initialAmount.toSignificant(6),
        },
        "Trading monitor started"
      );

      // Listen for price updates
      this.priceMonitor.on("priceUpdate", async (update) => {
        const baseToken = this.tokenManager.getToken("WETH")!;

        // First update the path finder with new pair data
        this.pathFinder.updatePair(update.pair);

        // Look for arbitrage opportunities with current prices
        const opportunities = await this.pathFinder.findArbitrageOpportunities(
          baseToken,
          initialAmount,
          3, // max path length
          "0.000001" // min profit in base token units
        );

        // Log any opportunities found
        for (const opportunity of opportunities) {
          this.logger.info(
            {
              path: opportunity.route.path.map((t) => t.symbol).join(" -> "),
              expectedProfit: opportunity.expectedProfit,
              inputAmount: initialAmount.toExact(),
              inputToken: baseToken.symbol,
            },
            "Arbitrage opportunity found"
          );
        }
      });

      this.priceMonitor.on("error", (error) => {
        this.logger.error({ err: error }, "Price monitor error");
      });
    } catch (error) {
      this.logger.error({ err: error }, "Failed to start trading monitor");
      throw error;
    }
  }

  async stop() {
    await this.priceMonitor.stop();
    await this.arbitrageCalculator.stop();
    await this.tradeExecutor.stop();
    this.logger.info("Trading monitor stopped");
  }
}
