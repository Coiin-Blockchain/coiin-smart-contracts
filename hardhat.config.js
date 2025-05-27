/** @type import('hardhat/config').HardhatUserConfig */

require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
const { mnemonic, infuraApiKey } = require('./secrets.json');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  // defaultNetwork: "mainnet",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      accounts: {mnemonic: mnemonic}
    },
    bscMainnet: {
      url: "https://bsc-dataseed.bnbchain.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: {mnemonic: mnemonic}
    },
    baseMainnet: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      gasPrice: 20000000000,
      accounts: {mnemonic: mnemonic}
    },
    baseSepolia: {
      url: 'https://sepolia.base.org',
      chainId: 84532,
      // gasPrice: 10000000000,
      accounts: {mnemonic: mnemonic}
    },
    sepolia: {
      url: 'https://sepolia.infura.io/v3/'+infuraApiKey,
      chainId: 11155111,
      gasMultiplier: 2,
      accounts: {mnemonic: mnemonic}
    }
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000
  },
  etherscan: {
    apiKey: {
      bscTestnet: 'RJHIR5WTVDP45AC7GX1CQVMGN95NQCEG1E',
      baseSepolia: '1XSUGT789RPQ7QQCPKUXYMGTS6WTWEWTEI',
      base: '1XSUGT789RPQ7QQCPKUXYMGTS6WTWEWTEI',
      sepolia: 'C427GK4CIJCHJ8JUST93RDV8AAU6BDB555'
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/"
        }
      }
    ]
  }
};
