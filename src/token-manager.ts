import { Token } from "@uniswap/sdk";
import { ChainId } from "@uniswap/sdk";
import { TokenConfig } from "./types";

export class TokenManager {
  private tokens: Map<string, Token>;
  private pairs: Array<[Token, Token]>;
  private chainId: ChainId;

  constructor(chainId: ChainId = ChainId.MAINNET) {
    this.tokens = new Map();
    this.pairs = [];
    this.chainId = chainId;
  }

  addToken(config: TokenConfig): Token {
    const token = new Token(
      this.chainId,
      config.address,
      config.decimals,
      config.symbol
    );
    this.tokens.set(config.symbol, token);

    // Generate new pairs with existing tokens
    for (const existingToken of this.tokens.values()) {
      if (existingToken.address !== token.address) {
        this.pairs.push([existingToken, token]);
      }
    }

    return token;
  }

  getToken(symbol: string): Token | undefined {
    return this.tokens.get(symbol);
  }

  getAllPairs(): Array<[Token, Token]> {
    return this.pairs;
  }

  getPairsForToken(symbol: string): Array<[Token, Token]> {
    const token = this.getToken(symbol);
    if (!token) return [];

    return this.pairs.filter(
      ([t1, t2]) => t1.address === token.address || t2.address === token.address
    );
  }
}
