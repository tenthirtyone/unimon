import { BaseService } from "./base.service";
import { Token, Pair, Fetcher } from "@uniswap/sdk";
import { ethers } from "ethers";

export class PriceMonitorService extends BaseService {
  private pairs: Map<string, Pair>;
  private symbolPairs: Map<string, string>;
  private isRunning: boolean;

  constructor(provider: ethers.providers.BaseProvider) {
    super(provider);
    this.pairs = new Map();
    this.symbolPairs = new Map();
    this.isRunning = false;
  }

  async addPair(tokenA: Token, tokenB: Token): Promise<Pair> {
    const pair = await Fetcher.fetchPairData(tokenA, tokenB, this.provider);
    const pairKey = this.getPairKey(tokenA, tokenB);
    const symbolKey = this.getSymbolKey(tokenA, tokenB);

    this.pairs.set(pairKey, pair);
    this.symbolPairs.set(pairKey, symbolKey);

    this.logger.info({ pairKey, symbolKey }, "Added pair to monitor");
    return pair;
  }

  private getSymbolKey(tokenA: Token, tokenB: Token): string {
    return `${tokenA.symbol}:${tokenB.symbol}`;
  }

  private getPairKey(tokenA: Token, tokenB: Token): string {
    return `${tokenA.address}-${tokenB.address}`;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.provider.on("block", this.onNewBlock.bind(this));
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.provider.removeListener("block", this.onNewBlock.bind(this));
  }

  private async onNewBlock(blockNumber: number): Promise<void> {
    try {
      this.logger.debug({ blockNumber }, "Processing new block");

      for (const [pairKey, pair] of this.pairs) {
        const updatedPair = await Fetcher.fetchPairData(
          pair.token0,
          pair.token1,
          this.provider
        );
        this.pairs.set(pairKey, updatedPair);
        const symbolKey = this.symbolPairs.get(pairKey);

        this.emit("priceUpdate", {
          pairKey,
          symbolKey: this.symbolPairs.get(pairKey),
          pair: updatedPair, // Include the actual pair
          price: updatedPair.token0Price.toSignificant(6),
          timestamp: Date.now(),
          blockNumber,
        });
      }
    } catch (error) {
      this.logger.error(
        {
          err: error,
          blockNumber,
        },
        "Failed to process block"
      );
      this.emit("error", error);
    }
  }
}
