# UniMonitor

This class monitors the price of WETH -> DAI, WETH -> USDC, and DAI -> USDC on the Ethereum mainnet. It can calculate the potential arbitrage opportunities and slippage amount for a given amount (1 WETH in this example). It will update on every new block.

## Installation

Clone this repository or download the code
Run npm install to install the required dependencies
Create a .env file in the root directory of the project and add the following line, replacing YOUR_INFURA_KEY with your Infura API key:
makefile
Copy code
INFURA_KEY=YOUR_INFURA_KEY
Run npm start to start the UniMonitor

## Usage

I use nodemon to hot reload

```bash
$ nodemon src/index.ts
```

but you can also just use ts-node

```bash
$ ts-node src/index.ts
```
