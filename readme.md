Description: This app is token sweeper that transfer erc-20 and native token from one wallet to another.

Usage:

Before start, erc20 token addresses must be listed at tokenlist.json file.
    e.g:
        [
            "0xE7C213183bAc92Bc0248061332C7C487c93daDEf",  JPYW Token
            "0x6AD196dBcd43996F17638B924d2fdEDFF6Fdd677"   Tehter USDT
        ]

- Running with .env file
        
        node main.js --env

    .env file must have rpc endpoint, destination address, wallet account counts, wallet seed phrase.

    e.g: 
        RPC_URL = 'https://goerli.infura.io/v3/206a5d70937646c1a7559f3a57b4fc54'
        DEST_ADDR = '0x74c864f501713F55648A82ba0Bc2577C7D9a05C6'
        WALLET_COUNT = 5
        WALLET_PHRASE = "transfer team true crush merge journey today swamp online idea flip inhale"

- Running with arguments

        node main.js --phrase 'transfer team true crush merge journey today swamp online idea flip inhale' --dest 0x74c864f501713F55648A82ba0Bc2577C7D9a05C6 --count 1 --url 'https://goerli.infura.io/v3/206a5d70937646c1a7559f3a57b4fc54'

    arguments:
        --phrase <'wallet seed phrase'>           
            Wallet seed phrase
        --dest <0x...>
            Destination wallet address
        --count <number> 
            Wallet account counts which will create from seed phrase
        --url <https://...>
            Rpc endpoint of specific chain


Please enjoy!!!# token_sweeper
