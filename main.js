const commander = require('commander');
const ethers = require('ethers');
const erc20Abi = require('./ERC20abi.json');
require('dotenv').config();
const tokenlist = require('./tokenlist.json');
commander
    .version('1.0.0', '-v, --version')
    .usage('[OPTIONS]...')
    .option('-e, --env', 'Running with env file')
    .option('-p, --phrase <value>', 'Wallet mnemonic phrase')
    .option('-d, --dest <value>', 'Destination address')
    .option('-u, --url <value>', 'RPC url', 'https://goerli.infura.io/v3/206a5d70937646c1a7559f3a57b4fc54')
    .option('-c, --count <value>', 'Address counts', 5)
    .parse(process.argv);

let tokenAddresses;

class TokenSweeper {
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(this.config.networkUrl);
        this.wallet = ethers.Wallet.fromPhrase(this.config.mnemonic, this.provider);
        this.walletList = new Array();
        this.walletList.push(this.wallet);

        for (let i=0; i<config.addr_counts-1; i++) {
            const wallet1 = this.wallet.deriveChild(i).connect(this.provider);
            this.walletList.push(wallet1);
        }
        console.log('wallet address list')
        for(let i=0; i<config.addr_counts; i++) {
            console.log(this.walletList.at(i).address)
        }
    // this.provider = new HDWalletProvider(this.config.mnemonic, this.config.networkUrl);
    // this.web3 = new Web3(this.provider);
    }

  async fetchTokenBalances(wallet) {
    
    try {
        let balances = {};
        const nativeBalance = await this.provider.getBalance(await wallet.getAddress());
        balances.native = nativeBalance;

        console.log('~~~~~~');
        console.log(`Balances of ${wallet.address} :`);
        console.log(`  - Native Token: ${nativeBalance.toString()}`);
        for (const tokenAddress of tokenAddresses) {
            const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
            const tokenBalance = await contract.balanceOf(await wallet.address);
            balances[tokenAddress] = tokenBalance;
            console.log(`  - Token <${tokenAddress}> : ${tokenBalance.toString()}`);
        }
        console.log('~~~~~~')
        return balances;

    } catch (error) {
      console.error(`Error fetching balances for ${wallet.address}:`, error);
      return {};
    }
  }

  async sweepFunds() {
    try {
      for (const wallet of this.walletList) {
        console.log('');
        console.log('*** Start sweeping funds from ', wallet.address, '***');
        console.log('');

        let balances = await this.fetchTokenBalances(wallet);
        await this.transferFunds(wallet, balances);
        console.log(balances.native.toString())
        console.log('');
        console.log('*** Finished sweeping funds from ', wallet.address, '***');
        console.log('');
      }
    } catch (error) {
      console.error('Sweeping funds error:', error);
    } finally {
    }
  }

  async transferFunds(wallet, balances) {
    try {
      const gasPriceWei = await (await this.provider.getFeeData()).gasPrice;
      // Transfer ERC20 tokens
      for (const tokenAddress of tokenAddresses) {
        console.log(`===== Start transfer ERC20 [${tokenAddress}] =====`);
        wallet.JsonRpcProvider = this.config.provider;
        const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
        if(!balances[tokenAddress] || balances[tokenAddress] === 0) 
        {
            console.log(`No balance for [${tokenAddress}]`)
            continue;
        }

        const estimatedGas = await contract.transfer.estimateGas(this.config.targetAddress, balances[tokenAddress]);
        const gasWillUse = estimatedGas * gasPriceWei * 110n /100n;
        
        console.log('EstimateGas for erc20 transfer : ', estimatedGas.toString(),' *', gasPriceWei.toString(), ' =',(estimatedGas*gasPriceWei).toString(), 'gas will use 110% :', gasWillUse.toString());
        if(balances.native < gasWillUse) {
            console.log('Insufficient gas fee for transfer token.  Balance of native token is', balances.native.toString());
            continue;
        }

        const enhancedGasPrice = gasPriceWei * 100n / 100n;
        const txtokentransfer = await contract.transfer(this.config.targetAddress, balances[tokenAddress], {
            gasPrice: enhancedGasPrice,
            gasLimit: estimatedGas,
        });

        const txtransferReceipt = await txtokentransfer.wait();
        if (txtransferReceipt.status !== 1) {
            console.log('transaction failed ', txtransferReceipt);
            continue;
        } else {
            balances.native = balances.native - txtransferReceipt.gasPrice * txtransferReceipt.gasUsed;

            console.log('   -------------------ERC-20 Token Transfereed Result------------------------')
            console.log(`        - From ${txtransferReceipt.from} To ${this.config.targetAddress}`)
            console.log(`        - Amount: ${balances[tokenAddress].toString()}`)
            console.log(`        - TxFee: ${(txtransferReceipt.gasPrice * txtransferReceipt.gasUsed).toString()}`)
            console.log(`        - TxHash: ${txtransferReceipt.hash} `)
            console.log('   ---------------------------------------------------------------------------')

        }
        console.log(`  Balance of native token`, balances.native.toString());
        console.log(`===== Finished transfer ERC20 [${tokenAddress}] =====`);
      }

      console.log(`======== Start native token transfer ========`);
      // Transfer native balance
      if(balances.native < 21000n*gasPriceWei) {
        console.log('Insufficient balance.  Balance of native token is', balances.native.toString());
        return;
      }
      let tx = {
        from: wallet.address,
        to: this.config.targetAddress,
        value: balances.native-21000n*gasPriceWei,
        gasPrice: gasPriceWei,
        gasLimit: 21000,
      }
      const estimatedNativeGas = await wallet.estimateGas(tx);
      const enhancedGasPrice = gasPriceWei * 100n / 100n;
      tx.gasLimit = estimatedNativeGas;
      tx.gasPrice = enhancedGasPrice;

      tx.value = balances.native - estimatedNativeGas * enhancedGasPrice;
      await wallet.sendTransaction(tx).then((nativeTransactionResult)=>{
        console.log('   -------------------Native Transfereed Result------------------------------')
        console.log(`        - From ${nativeTransactionResult.from} To ${this.config.targetAddress}`)
        console.log(`        - Amount: ${tx.value.toString()}`)
        console.log(`        - TxHash: ${nativeTransactionResult.hash} `)
        console.log('   ---------------------------------------------------------------------------')
        return nativeTransactionResult;
      }).catch((err)=>{
        console.log(`tx native failed `, nativeTransactionResult)
        return err;
      });
    } catch (error) {
      console.error(`Error transferring funds from ${wallet.address}:`, error);
    }
  }
}

// Main
const options = commander.opts();
async function main() {
    tokenAddresses = tokenlist
    console.log('$$$$$$$$$ Token address list $$$$$$$$$$$$')
    console.log(tokenAddresses);
    console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$')
    console.log('');

    if (options.env) {
        console.log('#######   Service is started with env file');
        if(!process.env.DEST_ADDR) {
            console.log("Destination address must be exist at .env file. e.g DEST_ADDR = <your wallet address>")
            return;
        }
        if(!process.env.WALLET_PHRASE) {
            console.log("Wallet mnemonic phrase must be exist at .env file. e.g WALLET_PHRASE = <wallet phrase>")
            return;
        }
        if(!process.env.WALLET_COUNT) {
            console.log("Wallet count must be exist at .env file. e.g WALLET_COUNT = 5")
            return;
        }

        if(!process.env.RPC_URL) {
            console.log("Rpc url must be exist at .env file. e.g RPC_URL = <https://...>")
            return;
        }
        const config = {
            networkUrl: process.env.RPC_URL,
            mnemonic: process.env.WALLET_PHRASE,
            targetAddress: process.env.DEST_ADDR,
            addr_counts: process.env.WALLET_COUNT,
        };

        const sweeper = new TokenSweeper(config);
        await sweeper.sweepFunds();
    } else {
        console.log('#######   Service is started with arguments');
        if(!options.phrase) {
            console.log("Wallet mnemonic phrase must be exist. --phrase <'wallet mnemonic phrase'>")
            return;
        }
        if(!options.dest) {
            console.log("Destination address must be exist. --dest <destination address>")
            return;
        }
        console.log('Input params: ', options)
    
        const config = {
            networkUrl: options.url,
            mnemonic: options.phrase,
            targetAddress: options.dest,
            addr_counts: options.count,
          };
    
        const sweeper = new TokenSweeper(config);
        await sweeper.sweepFunds();
    }

}

main();