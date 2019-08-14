
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    const TEST_ORACLES_COUNT = 60;
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

    let oracles = [];

    // start reading from accounts backward for the oracles
    let aIndex = accounts.length - 1; //TEST_ORACLES_COUNT + 9;
    for (let i = 0; i < TEST_ORACLES_COUNT; i++) {
        oracles.push(accounts[aIndex]);
        aIndex--;
    }
    // test variables (passengers, flights, timestamp ...etc)
    const TIMESTAMP = Math.floor(Date.now() / 1000);    // timestamp in seconds;
    let testPassIns = web3.utils.toWei("1.5", "ether"); // test passenger insurance that should fail (more than max of 1 ether)
    let passIns1 = web3.utils.toWei("1", "ether");      // passenger 1 insurance
    let passIns2 = web3.utils.toWei("0.5", "ether");    // passenger 2 insurance
    let passenger1 = accounts[7];   // passenger 1 address
    let passenger2 = accounts[8];   // passenger 2 address
    // flight 1 for testing flights
    let flight1 = {
        flight: "AM 1440",
        timestamp: TIMESTAMP
    };

    // flight 2 for testing flights
    let flight2 = {
        flight: "FO 1441",
        timestamp: TIMESTAMP
    };

    // authorize the App contract to call the data contract
    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`1. (multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");
    });

    it(`2. (multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`3. (multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`4. (multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSurety.setTestingMode(true);
        }
        catch (e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it('5. (airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
        // firstAirline is not funeded yet. It should fail to regsiter a new airline
        // ARRANGE
        let newAirline = accounts[2];   // new airline to be registered
        let result = true;

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(newAirline, "NewAirlineTest", { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);
        }
        result = await config.flightSuretyData.isRegisteredAirline.call(newAirline);

        // ASSERT
        assert.equal(result, false, "Non-funded Airline should not be able to register another airline");

    });


    it('6. (airline) funding is not accepted unless it is 10 ethers or more', async () => {
        // funding airline with less than 10 ethers should fail
        // ARRANGE
        let newAirline = accounts[2];
        let result = true;

        // ACT
        try {
            await config.flightSuretyApp.fundAirline({
                from: config.firstAirline,
                value: (config.weiMultiple * 9)
            }); // 9 ether

            await config.flightSuretyApp.registerAirline(newAirline, "NewAirlineTest", { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);
        }
        result = await config.flightSuretyData.isRegisteredAirline.call(newAirline);

        // ASSERT
        assert.equal(result, false, "The fund must be 10 ethers and more to consider an airline if funded!");

    });

    it('7. (airline) can register an Airline using registerAirline() after it gets funded sufficiently', async () => {
        // A funded airline can register a new airline using registerAirline()
        // ARRANGE
        let newAirline = accounts[2];

        // ACT
        try {
            await config.flightSuretyApp.fundAirline({
                from: config.firstAirline,
                value: (config.weiMultiple * 11)
            });

            await config.flightSuretyApp.registerAirline(newAirline, "NewAirlineTest", { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);

        }
        let result = await config.flightSuretyData.isRegisteredAirline.call(newAirline);

        // ASSERT
        assert.equal(result, true, "A funded airline can register another airline if the fund is 10 ethers and more!");

    });


    it('8. (airline) can register an Airline using registerAirline() only if it is itself is registered', async () => {
        // Non -registered airline cannot register other airlines
        // ARRANGE
        let newAirline5 = accounts[5]; // not registered
        let newAirline6 = accounts[6]; // to be registered
        let result = true;

        // ACT
        try {

            await config.flightSuretyApp.registerAirline(newAirline6, "NewAirlineTest6", { from: newAirline5 });
        }
        catch (e) {
            console.log(e.reason);

        }
        result = await config.flightSuretyData.isRegisteredAirline.call(newAirline6);

        // ASSERT
        assert.equal(result, false, "Only registered airline can register other airlines. This also must be after funding!");

    });

    // in this stage. First airline is funded and can register other airlines (actually, already registered one new)
    // we will try to register 3 more airlines. The first 2 should be registered right away
    // the 3rd one will be waiting for voting
    it('9. (airline) added in 5th position is not registered directly. It should wait for voting', async () => {
        // After registering 4 airlines, from 5th airline onwards should be waiting for voting
        // ARRANGE
        let newAirline3 = accounts[3];  // should be registered directly
        let newAirline4 = accounts[4];  // should be registered directly
        let newAirline5 = accounts[5];  // should wait for voting
        let result3 = false;    //these should be toggled after the ACT
        let result4 = false;
        let result5 = true;

        // ACT
        try {
            // await config.flightSuretyApp.fundAirline({
            //     from: config.firstAirline,
            //     value: (config.weiMultiple * 11)
            // });

            await config.flightSuretyApp.registerAirline(newAirline3, "NewAirlineTest3", { from: config.firstAirline });
            await config.flightSuretyApp.registerAirline(newAirline4, "NewAirlineTest4", { from: config.firstAirline });
            await config.flightSuretyApp.registerAirline(newAirline5, "NewAirlineTest5", { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);

        }
        result3 = await config.flightSuretyData.isRegisteredAirline.call(newAirline3);
        result4 = await config.flightSuretyData.isRegisteredAirline.call(newAirline4);
        result5 = await config.flightSuretyData.isRegisteredAirline.call(newAirline5);

        // ASSERT
        //assert.equal((result3 && result4 && !result5), true, "3rd & 4th should register directly. 5th should wait for voting!")
        assert.equal(result3, true, "3rd airline should be registered directly!");
        assert.equal(result4, true, "4th airline should be registered directly!");
        assert.equal(result5, false, "5th airline should NOT be registered directly! It should wait for voting!");

    });


    it('10.(airline) cannot register a new airline twice (no duplicates)!', async () => {
        // try to register already registered airline. It should fail
        // ARRANGE
        let newAirline3 = accounts[3];  // Already registered
        let errorFound = false;

        // ACT
        try {
            // trying to register airline 3 one more time. This should be prevented.
            await config.flightSuretyApp.registerAirline(newAirline3, "NewAirlineTest3", { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, true, "Cannot duplicate the registeration of an airline")

    });



    // less votings do not change status
    it('11.(airline) Less than 50% votes do not make a new airline registered', async () => {

        // I will vote for airline 5 using airline 1. It should not be registered yet.
        // ARRANGE
        let newAirline5 = accounts[5];
        let result5 = true;

        // ACT
        try {
            await config.flightSuretyApp.voteForAirline(newAirline5, { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);

        }
        result5 = await config.flightSuretyData.isRegisteredAirline.call(newAirline5);

        // ASSERT
        assert.equal(result5, false, "5th airline should NOT be registered by only 1 vote! It should wait for more voting!");

    });

    // No double voting
    it('12.(airline) is not allowed to duplicate votes to a new airline to be registered!', async () => {
        // I will vote for airline 5 using airline 1 Again. It should not be registered because of double voting not allowed!.
        // ARRANGE
        let newAirline5 = accounts[5];
        let result5 = true;

        // ACT
        try {
            await config.flightSuretyApp.voteForAirline(newAirline5, { from: config.firstAirline });
        }
        catch (e) {
            console.log(e.reason);

        }
        result5 = await config.flightSuretyData.isRegisteredAirline.call(newAirline5);

        // ASSERT
        assert.equal(result5, false, "5th airline should NOT be registered by duplicate votes!");

    });

    // non-funded airline cannot vote and cannot change the status to registered
    it('13.(airline) if not funded cannot vote and cannot change the status to registered!', async () => {
        // voting of airline 2 should not be considered because airline 2 is not funded yet!
        // ARRANGE
        let newAirline2 = accounts[2]; // not funded yet. Therefore, cannot vote.
        let newAirline5 = accounts[5];
        let result5 = true;

        // ACT
        try {
            await config.flightSuretyApp.voteForAirline(newAirline5, { from: newAirline2 });
        }
        catch (e) {
            console.log(e.reason);

        }

        result5 = await config.flightSuretyData.isRegisteredAirline.call(newAirline5);

        // ASSERT
        assert.equal(result5, false, "5th airline should NOT be registered if the voter is not funded!");

    });


    // enough votings make the change
    it('14.(airline) Getting 50% (or more) votes will be registered', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // first, we will fund airline 2 to make it qualified for voting.
        let newAirline5 = accounts[5]; // after airline 2 voting, airline5 should turn registered.
        let result5 = false;

        // ACT
        try {
            //fund airline 2
            await config.flightSuretyApp.fundAirline({
                from: newAirline2,
                value: (config.tenEther)
            });

            //airline 2 votes for airline5 (this is the second vote which should make it registered)
            await config.flightSuretyApp.voteForAirline(newAirline5, { from: newAirline2 });
        }
        catch (e) {
            console.log(e.reason);

        }

        result5 = await config.flightSuretyData.isRegisteredAirline.call(newAirline5);

        // ASSERT
        assert.equal(result5, true, "5th airline should NOT be registered unless it received at least 50% votings");

    });

    /* **********************************************************
    // at this point we have 5 airilnes registered (index 1 - 5);
    ********************************************************** */


    // trying to register a flight with non registered airline
    it('15.(flight) cannot be registered unless the airline is registered and funded', async () => {

        // ARRANGE
        let newAirline6 = accounts[6]; // will fund airline 2 to make it qualified for voting.
        let result = true;

        // ACT
        try {

            await config.flightSuretyApp.registerFlight(flight1.flight, flight1.timestamp, { from: newAirline6 });
        }
        catch (e) {
            console.log(e.reason);
        }

        result = await config.flightSuretyApp.isRegisteredFlight.call(flight1.flight, flight1.timestamp, newAirline6);

        // ASSERT
        assert.equal(result, false, "Flight cannot be registered by non-registered airline!");

    });

    // trying to register a flight with non funded airline
    it('16.(flight) cannot be registered if the airline is not funded even if registered', async () => {

        // ARRANGE
        let newAirline3 = accounts[3]; // airline 3 is registered but not funded
        let result = true;

        // ACT
        try {

            await config.flightSuretyApp.registerFlight(flight1.flight, flight1.timestamp, { from: newAirline3 });
        }
        catch (e) {
            console.log(e.reason);
        }

        result = await config.flightSuretyApp.isRegisteredFlight.call(flight1.flight, flight1.timestamp, newAirline3);

        // ASSERT
        assert.equal(result, false, "Flight cannot be registered by non-funded airline!");

    });

    // trying to register a flight with registered and funded airline. This should succeed
    it('17.(flight) can be registered only by registered and funded airline', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let result = false;

        // ACT
        try {

            await config.flightSuretyApp.registerFlight(flight1.flight, flight1.timestamp, { from: newAirline2 });
        }
        catch (e) {
            console.log(e.reason);
        }

        result = await config.flightSuretyApp.isRegisteredFlight.call(flight1.flight, flight1.timestamp, newAirline2);

        // ASSERT
        assert.equal(result, true, "Flight cannot be registered by non-funded airline!");

    });

    /* ***************************************************************
    // at this point light 1 is registerd for airline 2 (accounts[2]);
    *************************************************************** */


    // trying to register a flight again. This should fail (no duplicates allowed)
    it('18.(flight) cannot be registered twice!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {

            await config.flightSuretyApp.registerFlight(flight1.flight, flight1.timestamp, { from: newAirline2 });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, true, "Flight cannot be registered twice!");

    });

    // trying to buy insurance for a non-registered flight by passenger
    it('19.(passenger) cannot buy insurance for non-registered flight!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(newAirline2, flight2.flight, flight2.timestamp, { from: passenger1, value: passIns1 });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, true, "Cannot buy insurance for non-registered flight");

    });

    // trying to buy insurance for a registered flight by passenger with no funds
    it('20.(passenger) cannot buy insurance for registered flight with no funds!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(newAirline2, flight1.flight, flight1.timestamp, { from: passenger1 });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, true, "Cannot buy insurance for a flight without paying funds!");

    });


    // trying to buy insurance for a registered flight by passenger with funds exceeding maximum
    it('21.(passenger) cannot buy insurance for registered flight with funds exceeding maximum!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(newAirline2, flight1.flight, flight1.timestamp, { from: passenger1, value: testPassIns });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, true, "Cannot buy insurance for a flight with funds exceeding maximum!");

    });

    // trying to buy insurance for a registered flight by passenger with allowed funds -> should succeed
    it('22.(passenger) can buy insurance for registered flight with funds within limits!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(newAirline2, flight1.flight, flight1.timestamp, { from: passenger1, value: passIns1 });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, false, "Passenger can buy insurance for registered flight if funds within limits!");

    });

    // trying to buy insurance for the same flight by the same passenger
    it('23.(passenger) cannot buy insurance twice for the same flight!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(newAirline2, flight1.flight, flight1.timestamp, { from: passenger1, value: passIns1 });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, true, "Passenger cannot buy insurance for the same flight again!");

    });

    // trying to buy insurance for the same flight by another passenger = > should succeed
    it('24.(passenger) can buy insurance for the same flight bought by other passenger!', async () => {

        // ARRANGE
        let newAirline2 = accounts[2]; // airline 2 is registered and funded
        let errorFound = false;

        // ACT
        try {
            await config.flightSuretyApp.buyInsurance(newAirline2, flight1.flight, flight1.timestamp, { from: passenger2, value: passIns2 });
        }
        catch (e) {
            console.log(e.reason);
            errorFound = true;
        }

        // ASSERT
        assert.equal(errorFound, false, "Passenger can buy insurance for the same flight bought by others!");

    });

    it(`25.(oracles) can register ${TEST_ORACLES_COUNT} oracles`, async () => {

        // ARRANGE
        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

        // ACT
        let errorFound = false;
        for (let a = 0; a < oracles.length; a++) {
            try {
                await config.flightSuretyApp.registerOracle({ from: oracles[a], value: fee });
                let result = await config.flightSuretyApp.getMyIndexes.call({ from: oracles[a] });
                console.log(`Oracle Registered ${a}:  ${result[0]}, ${result[1]}, ${result[2]}`);
            }
            catch (e) {
                console.log(e);
                errorFound = true;
            }
        }
        assert.equal(errorFound, false, `Registered ${TEST_ORACLES_COUNT} oracles`);
    });


    // the funds must NOT be transfered directly to the passenger wallet as per rubric.
    // this is also tested here.
    it(`26.(oracles) can submit delay status that result in passenger credit`, async () => {

        // ARRANGE
        let errorFound = false;
        let balanceBefore = await web3.eth.getBalance(passenger1);
        let intBalanceBefore = parseInt(balanceBefore);
        let closedRequest = false;
        console.log("Passenger Balance Before: " + balanceBefore);

        // trigger the fetch status event
        await config.flightSuretyApp.fetchFlightStatus(accounts[2], flight1.flight, flight1.timestamp);
        let creditBefore = await config.flightSuretyApp.getPassengerCredit(passenger1, accounts[2], flight1.flight, flight1.timestamp);
        // ACT

        for (let a = 0; a < oracles.length; a++) {
            let indexes = await config.flightSuretyApp.getMyIndexes.call({ from: oracles[a] });
            for (let b = 0; b < indexes.length; b++) {
                //console.log(b);
                try {
                    await config.flightSuretyApp.submitOracleResponse(parseInt(indexes[b]), accounts[2], flight1.flight,
                        flight1.timestamp, STATUS_CODE_LATE_AIRLINE, { from: oracles[a] });
                    //console.log(`${indexes[b]}`);
                    console.log("No Error! - Match Found " + a);
                    //console.log(indexes);
                }
                // we can ignore the following errors but we need to capture any other error.
                // 'Index does not match oracle request' and 'Flight or timestamp do not match oracle request'
                catch (e) {
                    if (e.reason != 'Index does not match oracle request' && e.reason != 'Flight or timestamp do not match oracle request') {
                        if (e.reason == "Closed Responses!") {
                            console.log("Reached required number of responses!");
                            closedRequest = true;
                            //break;
                        }
                        else {
                            console.log(e);
                            errorFound = true;
                            break; // break the loop.
                        }

                    }
                    else {
                        continue;
                    }
                }
            }
        }

        let balanceAfter = await web3.eth.getBalance(passenger1);
        let intBalanceAfter = parseInt(balanceAfter);
        console.log("Passenger Balance After: " + balanceAfter);

        let credit = await config.flightSuretyApp.getPassengerCredit(passenger1, accounts[2], flight1.flight, flight1.timestamp);
        console.log("Credited to Passenger: " + credit);
        assert.equal(creditBefore == 0, true, "credit before finding status delayed is 0");
        assert.equal(credit > 0, true, "credit of passenger 1 has been added");
        assert.equal(errorFound, false, `delay reported by oracles causes credit to passengers with insurance!`);
        assert.equal(intBalanceBefore == intBalanceAfter, true, "No direct credit to the passenger balance!");
    });


    // check if all passengers with insurance on a flight got credited
    it(`27.(oracles) all passengers with insurance got credited`, async () => {


        let credit = await config.flightSuretyApp.getPassengerCredit(passenger2, accounts[2], flight1.flight, flight1.timestamp);
        console.log("Credited to Passenger: " + credit);
        assert.equal(credit > 0, true, "credit of passenger 2 has been added");
        //assert.equal(errorFound, false, `delay reported by oracles causes credit to passengers with insurance!`);
    });

    // check if passengers can withdraw credit to the wallet address on demand
    it(`28.(passenger) can withdraw the credit`, async () => {

        let balanceBefore = await web3.eth.getBalance(passenger1);
        console.log("Passenger Balance Before: " + balanceBefore);
        let intBalanceBefore = parseInt(balanceBefore);
        await config.flightSuretyApp.payInsurance(accounts[2], flight1.flight, flight1.timestamp, { from: passenger1 });
        let balanceAfter = await web3.eth.getBalance(passenger1);
        let intBalanceAfter = parseInt(balanceAfter);
        console.log("Passenger Balance After: " + balanceAfter);
        let credit = await config.flightSuretyApp.getPassengerCredit(passenger1, accounts[2], flight1.flight, flight1.timestamp);
        assert.equal(credit == 0, true, "credit consumed/moved to passenger account!");
        assert.equal(intBalanceBefore < intBalanceAfter, true, "balance changed!");

    });

});
