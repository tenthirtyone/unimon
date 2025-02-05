export interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
}

export interface DexConfig {
  name: string;
  routerAddress: string;
  factoryAddress: string;
}

export interface TradingConfig {
  maxSlippage: number;
  minProfitThreshold: number;
  maxGasPrice: number;
  minLiquidity: number;
}

export interface Config {
  network: string;
  providerUrl: string;
  tokens: Record<string, TokenConfig>;
  dexes: Record<string, DexConfig>;
  trading: TradingConfig;
}
