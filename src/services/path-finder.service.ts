import { BaseService } from "./base.service";
import {
  Token,
  Pair,
  Route,
  Trade,
  TokenAmount,
  TradeType,
  Percent,
  JSBI,
} from "@uniswap/sdk";
import { ethers } from "ethers";

interface PairData {
  pair: Pair;
  symbolKey: string;
}

export class PathFinderService extends BaseService {
  private pairs: Map<string, PairData>;
  private graph: Map<string, Set<string>>;

  constructor(provider: ethers.providers.BaseProvider) {
    super(provider);
    this.pairs = new Map();
    this.graph = new Map();
  }

  async start(): Promise<void> {
    this.logger.info(
      {
        pairCount: this.pairs.size,
        tokens: Array.from(this.graph.keys()).length,
      },
      "PathFinder service started"
    );
  }

  async stop(): Promise<void> {
    // Clear all data structures
    this.pairs.clear();
    this.graph.clear();
    this.logger.info("PathFinder service stopped");
  }

  // Called when a new pair is first discovered
  addPair(pair: Pair, symbolKey: string) {
    const pairKey = this.getPairKey(pair.token0, pair.token1);
    this.pairs.set(pairKey, { pair, symbolKey });

    // Update connection graph
    this.updateGraph(pair.token0.address, pair.token1.address);

    this.logger.info(
      {
        symbolKey,
        token0: pair.token0.symbol,
        token1: pair.token1.symbol,
        graphSize: this.graph.size,
        connections0: this.graph.get(pair.token0.address)?.size,
        connections1: this.graph.get(pair.token1.address)?.size,
      },
      "Added pair to path finder"
    );
  }

  // Called when pair data is updated (new reserves/prices)
  updatePair(pair: Pair) {
    const pairKey = this.getPairKey(pair.token0, pair.token1);
    const existing = this.pairs.get(pairKey);
    if (existing) {
      this.pairs.set(pairKey, { ...existing, pair });
    }
  }

  // Find and evaluate arbitrage opportunities starting from a token
  async findArbitrageOpportunities(
    startToken: Token,
    amount: TokenAmount,
    maxPathLength: number = 3,
    minProfitThreshold: string
  ): Promise<
    Array<{
      route: Route;
      expectedProfit: string;
      trades: Trade[];
    }>
  > {
    const opportunities: Array<{
      route: Route;
      expectedProfit: string;
      trades: Trade[];
    }> = [];
    this.logger.debug(
      {
        token: startToken.symbol,
        graphNodes: Array.from(this.graph.keys()).length,
        graphEdges: Array.from(this.graph.entries()).map(
          ([k, v]) => `${k}: ${v.size}`
        ),
      },
      "Starting arbitrage search"
    );
    const paths = this.findPaths(startToken, maxPathLength);
    this.logger.debug(
      {
        pathsFound: paths.length,
        paths: paths.map((path) => path.map((t) => t.symbol).join(" -> ")),
      },
      "Paths found"
    );
    this.logger.debug(`Found ${paths.length} possible paths to check`);

    for (const path of paths) {
      try {
        const pathSymbols = path.map((t) => t.symbol).join(" -> ");
        this.logger.debug(`Evaluating path: ${pathSymbols}`);

        const result = await this.evaluatePath(
          path,
          amount,
          minProfitThreshold
        );
        if (result) {
          this.logger.info(
            {
              path: pathSymbols,
              profit: result.expectedProfit,
            },
            "Found profitable path"
          );
          opportunities.push(result);
        } else {
          this.logger.debug(
            {
              path: pathSymbols,
            },
            "Path not profitable"
          );
        }
      } catch (error) {
        this.logger.error(
          {
            error,
            path: path.map((t) => t.symbol).join(" -> "),
          },
          "Error evaluating path"
        );
      }
    }

    return opportunities;
  }

  private findPaths(startToken: Token, maxLength: number): Token[][] {
    const paths: Token[][] = [];
    const visited = new Set<string>();

    const explore = (currentToken: Token, path: Token[]) => {
      this.logger.debug(
        {
          current: currentToken.symbol,
          pathSoFar: path.map((t) => t.symbol).join(" -> "),
          pathLength: path.length,
        },
        "Exploring node"
      );

      // Check if we can complete a cycle
      if (path.length >= 3 && this.hasConnection(currentToken, startToken)) {
        const cyclePath = [...path, startToken];
        this.logger.debug(
          {
            cyclePath: cyclePath.map((t) => t.symbol).join(" -> "),
          },
          "Found cycle"
        );
        paths.push(cyclePath);
        return;
      }

      // Don't exceed max length
      if (path.length >= maxLength) {
        return;
      }

      // Get connected tokens
      const connections = this.graph.get(currentToken.address) || new Set();

      for (const nextAddress of connections) {
        // Skip if already visited (except for completing cycles)
        if (visited.has(nextAddress) && nextAddress !== startToken.address) {
          continue;
        }

        // Skip the start token unless we're completing a cycle
        if (nextAddress === startToken.address && path.length < 2) {
          continue;
        }

        const nextToken = this.findTokenByAddress(nextAddress);
        if (!nextToken) continue;

        visited.add(nextAddress);
        explore(nextToken, [...path, nextToken]);
        visited.delete(nextAddress);
      }
    };

    visited.add(startToken.address);
    explore(startToken, [startToken]);

    return paths;
  }

  // Helper method to check if two tokens have a direct connection
  private hasConnection(tokenA: Token, tokenB: Token): boolean {
    const connections = this.graph.get(tokenA.address) || new Set();
    return connections.has(tokenB.address);
  }

  private async evaluatePath(
    path: Token[],
    inputAmount: TokenAmount,
    minProfitThreshold: string
  ): Promise<{
    route: Route;
    expectedProfit: string;
    trades: Trade[];
  } | null> {
    const pathSymbols = path.map((t) => t.symbol).join(" -> ");
    this.logger.debug(`Collecting pairs for path: ${pathSymbols}`);

    try {
      // Collect pairs for this path
      const pairs: Pair[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const tokenA = path[i];
        const tokenB = path[i + 1];

        // Try both orderings of the pair key
        const key1 = this.getPairKey(tokenA, tokenB);
        const key2 = this.getPairKey(tokenB, tokenA);

        const pairData = this.pairs.get(key1) || this.pairs.get(key2);

        if (!pairData) {
          this.logger.debug(
            {
              tokenA: tokenA.symbol,
              tokenB: tokenB.symbol,
            },
            "Missing pair data"
          );
          return null;
        }

        // Log pair details before adding
        this.logger.debug(
          {
            tokenA: tokenA.symbol,
            tokenB: tokenB.symbol,
            pairToken0: pairData.pair.token0.symbol,
            pairToken1: pairData.pair.token1.symbol,
            reserve0: pairData.pair.reserve0.toExact(),
            reserve1: pairData.pair.reserve1.toExact(),
          },
          "Adding pair to route"
        );

        pairs.push(pairData.pair);
      }

      // Create and validate the route before trading
      const route = new Route(pairs, path[0], path[path.length - 1]);

      this.logger.debug(
        {
          path: route.path.map((t) => t.symbol).join(" -> "),
          midPrice: route.midPrice.toSignificant(6),
          midPriceInverse: route.midPrice.invert().toSignificant(6),
        },
        "Route details"
      );

      // Create the trade
      const trade = new Trade(route, inputAmount, TradeType.EXACT_INPUT);
      const gasCostWei = await this.calculateGasCost(path);
      const gasCostEth = ethers.utils.formatEther(gasCostWei);

      // Calculate potential profit only if output > input
      const isProfitable = JSBI.greaterThan(
        trade.outputAmount.raw,
        inputAmount.raw
      );
      const potentialProfit = isProfitable
        ? trade.outputAmount.subtract(inputAmount).toExact()
        : "0";

      this.logger.info(
        {
          inputAmount: inputAmount.toExact(),
          outputAmount: trade.outputAmount.toExact(),
          executionPrice: trade.executionPrice.toSignificant(6),
          priceImpact: trade.priceImpact.toSignificant(6),
          gasCostEth,
          potentialProfit,
          minimumAmountOut: trade
            .minimumAmountOut(new Percent("50", "10000"))
            .toExact(),
          path: pathSymbols,
        },
        "Trade calculation"
      );

      if (isProfitable) {
        const rawProfit = trade.outputAmount.subtract(inputAmount);
        const profitInWei = ethers.utils.parseEther(rawProfit.toExact());
        const netProfitWei = profitInWei.sub(gasCostWei);

        if (netProfitWei.gt(0)) {
          return {
            route,
            expectedProfit: ethers.utils.formatEther(netProfitWei),
            trades: [trade],
          };
        }
      }
    } catch (error) {
      this.logger.error(
        {
          error,
          path: pathSymbols,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Path evaluation failed"
      );
    }

    return null;
  }

  private updateGraph(token0Address: string, token1Address: string) {
    if (!this.graph.has(token0Address)) {
      this.graph.set(token0Address, new Set());
    }
    if (!this.graph.has(token1Address)) {
      this.graph.set(token1Address, new Set());
    }

    this.graph.get(token0Address)!.add(token1Address);
    this.graph.get(token1Address)!.add(token0Address);
  }

  private getPairKey(token0: Token, token1: Token): string {
    return token0.address < token1.address
      ? `${token0.address}-${token1.address}`
      : `${token1.address}-${token0.address}`;
  }

  private findTokenByAddress(address: string): Token | null {
    for (const { pair } of this.pairs.values()) {
      if (pair.token0.address === address) return pair.token0;
      if (pair.token1.address === address) return pair.token1;
    }
    return null;
  }

  private async calculateGasCost(path: Token[]): Promise<ethers.BigNumber> {
    // estimate gas costs for now
    const SWAP_BASE_GAS = 100000; // Base gas for swap
    const GAS_PER_HOP = 65000;
    const hops = path.length - 1;
    const gasEstimate = SWAP_BASE_GAS + GAS_PER_HOP * (hops - 1);

    const gasPrice = await this.provider.getGasPrice();
    return gasPrice.mul(gasEstimate);
  }
}
