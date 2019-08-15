import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        // to use for status text
        const STATUS_CODE_UNKNOWN = 0;
        const STATUS_CODE_ON_TIME = 10;
        const STATUS_CODE_LATE_AIRLINE = 20;
        const STATUS_CODE_LATE_WEATHER = 30;
        const STATUS_CODE_LATE_TECHNICAL = 40;
        const STATUS_CODE_LATE_OTHER = 50;

        // to be used for status text
        this.flightStatus = [];
        this.flightStatus[STATUS_CODE_UNKNOWN] = "Uknown";
        this.flightStatus[STATUS_CODE_ON_TIME] = "On Time";
        this.flightStatus[STATUS_CODE_LATE_AIRLINE] = "Late Due to Airline";
        this.flightStatus[STATUS_CODE_LATE_WEATHER] = "Late Due to Weather Conditions";
        this.flightStatus[STATUS_CODE_LATE_TECHNICAL] = "Late Due to Technical Issues";
        this.flightStatus[STATUS_CODE_LATE_OTHER] = "Late Due to Other Reasons";

        let config = Config[network];
        this.conf = config;
        //this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        // for testing, new flights will be registered in every run (refresh of this DApp)
        // timestamp will be different in each run which means new different flight
        this.flights = [
            {
                flight: "AMA 1984",
                timestamp: Math.floor(Date.now() / 1000)
            },
            {
                flight: "FAO 1990",
                timestamp: Math.floor(Date.now() / 1000)
            },
            {
                flight: "KAA 2013",
                timestamp: Math.floor(Date.now() / 1000)
            },
            {
                flight: "MAA 2016",
                timestamp: Math.floor(Date.now() / 1000)
            }
        ];
    }

    initialize(callback) {
        this.web3.eth.getAccounts(async (error, accts) => {

            this.owner = accts[0]; // we know that accounts[0] is the owner
            // we know also that the first airline that gets registered upon deyployment is accounts[1]

            let counter = 1;

            while (this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while (this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            try {
                await this.flightSuretyData.methods.authorizeCaller(this.conf.appAddress).send({ from: this.owner, gas: 6666666 });
                // try to fund the first airline to be able to register flights.
                await this.flightSuretyApp.methods.fundAirline().send({
                    from: this.airlines[0],
                    value: this.web3.utils.toWei('10', 'ether'),
                    gas: 6666666
                });

                for (let i = 0; i < this.flights.length; i++) {
                    await this.flightSuretyApp.methods
                        .registerFlight(this.flights[i].flight, this.flights[i].timestamp)
                        .send({
                            from: this.airlines[0],
                            gas: 6666666
                        });
                }
            }
            catch (e) {
                console.log(e);
            }

            callback();
        });
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner }, callback);
    }

    // submitting oracle request for any query by the users
    fetchFlightStatus(flight, callback) {
        let self = this;
        //console.log(flight);
        let payload = {
            airline: self.airlines[0],
            flight: flight.flight,
            timestamp: Math.floor(Date.now() / 1000),
            flightObj: flight
        }
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.flightObj.timestamp)
            .send({ from: self.owner, gas: 6666666 }, (error, result) => {
                //console.log(result);
                callback(error, payload);
            });
    }

    // withdraw credit
    //function payInsurance(address _airline, string _flight, uint256 _timestamp) external requireIsOperational
    async withdrawCredit(flight, callback) {
        let self = this;
        //console.log(flight);
        
        let payload = {
            airline: self.airlines[0],
            flight: flight.flight,
            timestamp: Math.floor(Date.now() / 1000),
            flightObj: flight,
            passenger: self.passengers[0]
        }
        try {
            await self.flightSuretyApp.methods
            .payInsurance(payload.airline, payload.flight, payload.flightObj.timestamp)
            .send({ from: payload.passenger, gas: 6666666 });

            let balance = await self.web3.eth.getBalance(self.passengers[0]);
            let credit = await self.flightSuretyApp.methods.getPassengerCredit(payload.passenger, payload.airline, payload.flight, payload.flightObj.timestamp).call( {from: self.owner, gas: 6666666});
            payload.balance = balance;
            payload.credit = credit;

            callback(null, payload);

        }
        catch (e)
        {
            callback(e, null);
        }
    }


    //simulate buying insurance by passenger[0]. This will be the passenger being used for testing
    async buyInsurance(flight, ethers, callback) {
        //receiving flight object (flight is object here)
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight.flight,
            timestamp: flight.timestamp,
            ethers: self.web3.utils.toWei(ethers, "ether")
        };

        try {
            await self.flightSuretyApp.methods
                .buyInsurance(payload.airline, payload.flight, payload.timestamp)
                .send({ from: self.passengers[0], value: payload.ethers, gas: 6666666 });
                payload.balance = await this.web3.eth.getBalance(self.passengers[0]);
            callback(null, payload);
        }
        catch (e) {
            //console.log(e.message);
            callback(e, null);
        }
    }

    // receiveFlightStatus(callback) {
    //     this.flightSuretyApp.events.FlightStatusInfo({
    //         fromBlock: 0
    //     }, (err, event) => {


    //         if (err) {
    //             console.log(err);
    //             callback(err, null);
    //         }

    //     }).on('data', event => {
    //         let obj = event.returnValues;
    //         obj.statusText = this.flightStatus[obj.status];
    //         //console.log(obj);
    //         callback(null, obj); 
    //     });
    // }

    // receiving FlightStatusInfo event
    async receiveFlightStatus(callback) {
        let self = this;
        this.flightSuretyApp.events.FlightStatusInfo({
            fromBlock: await this.web3.eth.getBlockNumber()
        }, async (err, event) => {

            console.log(event.returnValues);
            if (err) {
                console.log(err);
                callback(err, null);
            }
            else {
                // getting the response of oracles and adding the text of the status
                let obj = event.returnValues;
                console.log(obj.status);
                obj.statusText = self.flightStatus[obj.status];
                let balance = await self.web3.eth.getBalance(self.passengers[0]);
                let credit = await self.flightSuretyApp.methods.getPassengerCredit(self.passengers[0], obj.airline, obj.flight, obj.timestamp).call( {from: self.owner, gas: 6666666});
                obj.balance = balance;
                obj.credit = credit;
                if (obj.status == 20)
                {
                    //getPassengerCredit(address _passenger, address _airline, string _flight, uint256 _timestamp)
                    
                    //onsole.log("credit " + credit);
                    //.send({ from: self.passengers[0]});
                }
                //console.log(obj);
                callback(null, obj);
            }

        });
    }


}