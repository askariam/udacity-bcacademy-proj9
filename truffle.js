var HDWalletProvider = require("truffle-hdwallet-provider");
//var mnemonic = "earth between aunt blouse crash squeeze climb dune demise clog observe whale"; //Ganache GUI
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {

  // I commented the below config for the network because it keeps giving errors related to nonce
  // Error: the tx doesn't have the correct nonce. account has nonce of: 2 tx has nonce of: 1
  // I replaced it with the configuration below and the error got resolved

  // networks: {
  //   development: {
  //     provider: function() {
  //       return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
  //     },
  //     network_id: '*',
  //     gas: 6666666,
  //     gasPrice: 20000000000
  //   }
  // },
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost
      port: 8545,            // Standard Ganache port
      network_id: "*", 
      gas: 6711111 ,
      gasPrice: 210000000
    }
  },
  compilers: {
    solc: {
      // version: "^0.5.2" 
      version: "^0.4.25"   //define the solidity compiler version
    }
  }
};


//mnemonic : 
//spirit supply whale amount human item harsh scare congress discover talent hamster

/*


ganache-cli --gasLimit 300000000 --gasPrice 20000000000 -a 50 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
ganache-cli -a 50 -m "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"
Ganache CLI v6.4.3 (ganache-core: 2.5.5)

Available Accounts
==================
(0) 0x627306090abab3a6e1400e9345bc60c78a8bef57 (~100 ETH) -- Owner
(1) 0xf17f52151ebef6c7334fad080c5704d77216b732 (~100 ETH) -- First Airline
(2) 0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef (~100 ETH) -- Second Airline
(3) 0x821aea9a577a9b44299b9c15c88cf3087f3b5544 (~100 ETH) -- Third Airline
(4) 0x0d1d4e623d10f9fba5db95830f7d3839406c6af2 (~100 ETH) -- Fourth Airline
(5) 0x2932b7a2355d6fecc4b5c0b6bd44cc31df247a2e (~100 ETH) -- Fifth Airline
(6) 0x2191ef87e392377ec08e7c08eb105ef5448eced5 (~100 ETH)
(7) 0x0f4f2ac550a1b4e2280d04c21cea7ebd822934b5 (~100 ETH)
(8) 0x6330a553fc93768f612722bb8c2ec78ac90b3bbc (~100 ETH)
(9) 0x5aeda56215b167893e80b4fe645ba6d5bab767de (~100 ETH)
(10) 0xe44c4cf797505af1527b11e4f4c6f95531b4be24 (~100 ETH)
(11) 0x69e1cb5cfca8a311586e3406ed0301c06fb839a2 (~100 ETH)
(12) 0xf014343bdffbed8660a9d8721dec985126f189f3 (~100 ETH)
(13) 0x0e79edbd6a727cfee09a2b1d0a59f7752d5bf7c9 (~100 ETH)
(14) 0x9bc1169ca09555bf2721a5c9ec6d69c8073bfeb4 (~100 ETH)
(15) 0xa23eaef02f9e0338eecda8fdd0a73add781b2a86 (~100 ETH)
(16) 0xc449a27b106be1120bd1fd62f8166a2f61588eb9 (~100 ETH)
(17) 0xf24ae9ce9b62d83059bd849b9f36d3f4792f5081 (~100 ETH)
(18) 0xc44b027a94913fb515b19f04caf515e74ae24fd6 (~100 ETH)
(19) 0xcb0236b37ff19001633e38808bd124b60b1fe1ba (~100 ETH)
(20) 0x715e632c0fe0d07d02fc3d2cf630d11e1a45c522 (~100 ETH)
(21) 0x90ffd070a8333acb4ac1b8eba59a77f9f1001819 (~100 ETH)
(22) 0x036945cd50df76077cb2d6cf5293b32252bce247 (~100 ETH)
(23) 0x23f0227fb09d50477331d2bb8519a38a52b9dfaf (~100 ETH)
(24) 0x799759c45265b96cac16b88a7084c068d38afce9 (~100 ETH)
(25) 0xa6bfe07b18df9e42f0086d2fce9334b701868314 (~100 ETH)
(26) 0x39ae04b556bbdd73123bab2d091dcd068144361f (~100 ETH)
(27) 0x068729ec4f46330d9af83f2f5af1b155d957bd42 (~100 ETH)
(28) 0x9ee19563df46208d4c1a11c9171216012e9ba2d0 (~100 ETH)
(29) 0x04ab41d3d5147c5d2bdc3bcfc5e62539fd7e428b (~100 ETH)
(30) 0xef264a86495ff640481d7ac16200a623c92d1e37 (~100 ETH)
(31) 0x645fdc97c87c437da6b11b72471a703df3702813 (~100 ETH)
(32) 0xbe6f5bf50087332024634d028ecf896c7b482ab1 (~100 ETH)
(33) 0xce527c7372b73c77f3a349bfbce74a6f5d800d8e (~100 ETH)
(34) 0x21ec0514bffeff9e0ee317b8c87657e4a30f4fb2 (~100 ETH)
(35) 0xeaa2fc390d0ec1d047dcc1210a9bf643d12de330 (~100 ETH)
(36) 0xc5fa34ecbaf44181f1d144c13fbaed69e76b80f1 (~100 ETH)
(37) 0x4f388ee383f1634d952a5ed8e032dc27094f44fd (~100 ETH)
(38) 0xeef5e3535aa39e0c2266bba234e187ada9ed50a1 (~100 ETH)
(39) 0x6008e128477ceee5561fe2deadd82564d29fd249 (~100 ETH)
(40) 0xfef504c230aa4c42707fcbffa46ae640498bc2cb (~100 ETH)
(41) 0x70c8f02d4e44d906e80a8d0b1591ab569a20ae9c (~100 ETH)
(42) 0x53ef3e89950e97bad7d027f41ab05debc7bb5c74 (~100 ETH)
(43) 0xe3c27a49b81a7d59dc516d58ab2e5ee6a545c008 (~100 ETH)
(44) 0xc496e6feacf5d7ee4e1609179fa4c1d1698116ec (~100 ETH)
(45) 0x5598ca13044003326c25459b4e9b778922c8a00e (~100 ETH)
(46) 0x5fb25c1c734d077fdfb603e9f586bee11706a042 (~100 ETH)
(47) 0x3e5a0f348c831b489dec1be087f8ef182a4cfe54 (~100 ETH)
(48) 0x6a90ed741fe4b87545a127879ba18f41fd17fdb5 (~100 ETH)
(49) 0xa1ad47355b994cc18bd709789055defd54e738e3 (~100 ETH)
*/