import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

// to listen to event we needed to use websocket provider as the http provider does not support event supbsription
let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

// here we will implement similar logic for oracles to that we used in the test file
// we need oracles 
const TEST_ORACLES_COUNT = 60;
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

let statusArray = [STATUS_CODE_UNKNOWN, STATUS_CODE_ON_TIME, STATUS_CODE_LATE_AIRLINE, STATUS_CODE_LATE_WEATHER,
  STATUS_CODE_LATE_TECHNICAL, STATUS_CODE_LATE_OTHER];


function getRandomStatus() {
  let randIndex = Math.floor(Math.random() * statusArray.length);
  return statusArray[randIndex];
}

let accounts = [];
// oracles array
let oracles = [];
let indexes = []; // array of array -> indexes[0] = indexes of oracles[0] & indexes[1] = indexes of oracles[1] and so on.
let randoms = []; // array that will store random status for each oracle from the beginning;
let owner;

web3.eth.getAccounts(async (error, accts) => {
  accounts = accts;
  owner = accounts[0];
  console.log("owner: " + owner);
  let aIndex = accts.length - 1; // TEST_ORACLES_COUNT + 9;
  for (let i = 0; i < TEST_ORACLES_COUNT; i++) {
    oracles.push(accounts[aIndex]);
    aIndex--;
  }

  let fee = web3.utils.toWei('1', 'ether');

  for (let a = 0; a < oracles.length; a++) {
    try {
      await flightSuretyApp.methods.registerOracle().send({ from: oracles[a], value: fee, gas: 6600000 });
      let result = await flightSuretyApp.methods.getMyIndexes().call({ from: oracles[a] });
      indexes[a] = result;
      randoms[a] = getRandomStatus();
      console.log(`Oracle Registered ${a}:  ${result[0]}, ${result[1]}, ${result[2]}`);
      //   }
      //console.log (result);
      // let result = await flightSuretyApp.methods.getMyIndexes().call({ from: oracles[a] }, (err, res) => {
      //   if (err)
      //   {
      //     console.log(err);
      //   }
      //   else{
      //     console.log(`Oracle Registered ${a}:  ${res[0]}, ${res[1]}, ${res[2]}`);
      //   }
      // });

    }
    catch (e) {
      console.log(e);
    }
  }

});

//emit OracleRequest(index, airline, flight, timestamp); emit statement from the contract.
// subscribe for the event
flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, async function (error, event) {
  if (error) {
    console.log(error);
  }
  else {
    let values = event.returnValues;
    let index = values.index;
    let airline = values.airline;
    let flight = values.flight;
    let timestamp = values.timestamp;
    /*
    Server will loop through all registered oracles, identify those oracles for which the OracleRequest event applies,
    and respond by calling into FlightSuretyApp contract with random status code of Unknown (0), On Time (10) or
    Late Airline (20), Late Weather (30), Late Technical (40), or Late Other (50)
    */
    for (let a = 0; a < oracles.length; a++) {
      randoms[a] = getRandomStatus();
      let ixx = indexes[a].indexOf(index);
      console.log(`\nOracle ${a}  indexes: ` + indexes[a]);
      console.log(`Matching Index: ${ixx} => ${indexes[a][ixx]}`);
      if (ixx != -1) {
        //let randomStatus = getRandomStatus();
        try {
          console.log("Returned Status: " + randoms[a]);
          await flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, randoms[a]).send({ from: oracles[a] });
        }
        catch (e) {
          if (e.message.indexOf("Closed Responses!") >= 0) {
            console.log("Status Closed: (Required Number of Responses for one Status is Reached!)");
            //break;
          }
          else {
            console.log(e.message);
          }
        }
      }
    }
  }

});

const app = express();
app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

export default app;


