import { ethers } from "ethers";
import EventEmitter from "events";
import pino from "pino";

export abstract class BaseService extends EventEmitter {
  protected provider: ethers.providers.BaseProvider;
  protected logger: any; // Will be replaced with proper logger

  constructor(provider: ethers.providers.BaseProvider) {
    super();
    this.provider = provider;
    this.logger = pino({
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "HH:MM:ss",
        },
      },
    });
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  public getLogger(): pino.Logger {
    return this.logger;
  }
}
