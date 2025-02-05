// src/services/trade-executor.service.ts
import { ethers, BigNumber, Contract } from "ethers";
import { BaseService } from "./base.service";
import { MaxUint256 } from "@ethersproject/constants";
import { Trade, TokenAmount, Percent, Token } from "@uniswap/sdk";

export class TradeExecutorService extends BaseService {
  private wallet: ethers.Wallet;
  private isExecuting: boolean;

  constructor(provider: ethers.providers.BaseProvider, privateKey: string) {
    super(provider);
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.isExecuting = false;
  }

  async executeTrade(
    trade: Trade,
    maxSlippage: number
  ): Promise<ethers.ContractTransaction | null> {
    if (this.isExecuting) {
      this.logger.warn("Trade execution already in progress");
      return null;
    }

    const routerAddress = trade.route.pairs[0].liquidityToken.address;
    const inputToken = (trade.inputAmount as TokenAmount).token;
    const approved = await this.checkAndApproveToken(
      inputToken,
      routerAddress,
      BigNumber.from(trade.inputAmount.raw.toString())
    );

    if (!approved) {
      this.logger.error("Token approval failed");
      return null;
    }

    try {
      this.isExecuting = true;
      this.logger.info(
        {
          route: trade.route.path.map((token) => token.symbol).join(" -> "),
          inputAmount: trade.inputAmount.toSignificant(6),
          outputAmount: trade.outputAmount.toSignificant(6),
        },
        "Executing trade"
      );

      const slippageTolerance = new Percent(
        Math.floor(maxSlippage * 100).toString(),
        "10000"
      );

      // Get current gas price
      const gasPrice = await this.provider.getGasPrice();
      this.logger.debug({ gasPrice: gasPrice.toString() }, "Current gas price");

      // Execute the trade
      const tx = await this.sendTransaction(trade, slippageTolerance, gasPrice);

      this.logger.info(
        {
          txHash: tx.hash,
          gasPrice: tx.gasPrice?.toString(),
          gasLimit: tx.gasLimit.toString(),
        },
        "Trade transaction sent"
      );

      return tx;
    } catch (error) {
      this.logger.error({ err: error }, "Failed to execute trade");
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  private async sendTransaction(
    trade: Trade,
    slippageTolerance: Percent,
    gasPrice: ethers.BigNumber
  ): Promise<ethers.ContractTransaction> {
    // Get the router contract
    const router = new ethers.Contract(
      trade.route.pairs[0].liquidityToken.address,
      [
        "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
      ],
      this.wallet
    );

    // Prepare transaction parameters
    const path = trade.route.path.map((token) => token.address);
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    const amountIn = trade.inputAmount.raw.toString();
    const amountOutMin = trade
      .minimumAmountOut(slippageTolerance)
      .raw.toString();

    // Send transaction
    return router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      this.wallet.address,
      deadline,
      { gasPrice }
    );
  }

  private async checkAndApproveToken(
    token: Token,
    spender: string,
    amount: BigNumber
  ): Promise<boolean> {
    const tokenContract = new Contract(
      token.address,
      [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
      ],
      this.wallet
    );

    try {
      const allowance = await tokenContract.allowance(
        this.wallet.address,
        spender
      );
      if (allowance.lt(amount)) {
        this.logger.info(
          {
            token: token.symbol,
            spender,
            amount: amount.toString(),
          },
          "Approving token"
        );

        const tx = await tokenContract.approve(spender, MaxUint256);
        await tx.wait();

        this.logger.info(
          {
            token: token.symbol,
            txHash: tx.hash,
          },
          "Token approved"
        );
      }
      return true;
    } catch (error) {
      this.logger.error({ err: error }, "Failed to approve token");
      return false;
    }
  }

  async start(): Promise<void> {
    // Initialize any necessary resources
    this.logger.info(
      {
        address: this.wallet.address,
      },
      "Trade executor started"
    );
  }

  async stop(): Promise<void> {
    // Cleanup any resources
    this.logger.info("Trade executor stopped");
  }
}
