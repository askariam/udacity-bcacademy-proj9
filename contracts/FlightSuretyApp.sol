pragma solidity ^0.4.25;
// pragma solidity ^0.5.2;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)
    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    
    // Having the status in the App contract allows us to add more status later if needed  (using upgrade)
    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    FlightSuretyData dataContract;          // declare data contract
    address private contractOwner;          // Account used to deploy contract


    uint256 private maxInsurance = 1 ether;     // rubric requirements passenger can pay up to 1 ether
    uint256 private votingLimit = 4;            // to capture airline voting threshold
    uint256 private insuranceRate = 150;        // to store insurance rate 150%
    // this will elminate the need to upgrade the App contract if the business requirements change for number of voters
    // or for maximum insurance a passenger can pay, or the insurance rate


    // Flight Struct
    struct Flight {
        bool isRegistered;          // registered flight
        uint8 statusCode;           // status of the flight
        uint256 updatedTimestamp;   // flight timestamp
        address airline;            // airline operating the flight
    }

    // Mapping from flight key (hash) to flight object (struct)
    mapping(bytes32 => Flight) private flights; //mapping (list) of flights

    // Airline struct
    // to capture airlines intermediate state (before approval by voting)
    struct Airline {
        string name;
        bool waitingVotes;
    }

    // to capture votes per voter and prevent double voting
    struct Vote {
        uint256 vote;
    }

    mapping(address => Airline) private airlines;               //mapping from airline address to airline object (struct)
    mapping(address => address[]) private votesPerAirline;      //mainly to count voters per new airline
    mapping(address => mapping(address => Vote)) votingRecords; //mainly to check if vote already exist voter -> candidate -> count
    mapping(address => bool) private voters;                    //funded airlines
    mapping(bytes32 => address[]) private flightPassengers;     //passengers in a flight

 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        // I have a concern here. I think we need to have IsOperational special for the App contract too.
        // Modify to call data contract's status
        require(dataContract.isOperational(), "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    // Only funded airlines can vote/perform actions in the contract
    modifier requireIsVoter(address _airline)
    {
        require (voters[_airline], "Airline cannot perform actions because it is not funded yet!");
        _;
    }

    // Only registered airlines
    modifier requireRegisteredAirline(address _airline)
    {
        require(dataContract.isRegisteredAirline(_airline), "Airline is not registered!");
        _;
    }

    // Only funded airlines
    modifier requireFundedAirline(address _airline)
    {
        require(dataContract.isFundedAirline(_airline), "Airline is not funded!");
        _;
    }

    // Airline is waiting for votes
    modifier requireWaitingVotes(address _airline)
    {
        require(airlines[_airline].waitingVotes, "The airline is not waiting for votes!");
        _;
    }


    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor (it takes data contract address as argument)
    *
    */
    constructor(address _dataAddress) public
    {
        contractOwner = msg.sender;                    //set the contract owner to be the deployer
        dataContract = FlightSuretyData(_dataAddress); //instantiate the data contract
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    // Implemented only as directed by the comments
    function isOperational() public view returns(bool)
    {
        return dataContract.isOperational();  // Modify to call data contract's status
    }

    // To make the App Contract flexible for business rules changes without the need for upgrade
    // Upgrade can be used for more complicated changes

    // set the number of registered airlines before starting voting for new airlines registration
    // initially, it is set to 4 airlines before starting voting
    function setVotingLimit(uint256 _limit) public requireContractOwner
    {
        require (_limit > 3, "Voting thershold must be greater than 3!"); //assumption
        votingLimit = _limit;
    }

    // set the maximum insurance amount the passenger can pay
    // initially, it is 1 ether.
    function setMaxInsurance(uint256 _maxInsurance) public requireContractOwner
    {
        maxInsurance = _maxInsurance;
    }

    // set the rate of insurance formula based on what passenger paid.
    // initially, it is X1.5 from what the passenger paid
    function setInsuranceRate(uint256 _rate) public requireContractOwner
    {
        insuranceRate = _rate;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

  
   /**
    * @dev Add an airline to the registration queue
    *
    */
    // function to add/register new airline
    // contract must be operational
    // caller must be registered airline
    // airline passed to this function must not be waiting for votes (already in registration process)
    // airline passed to this function must not be registered before.
    function registerAirline(address _airline, string _name) external requireRegisteredAirline(msg.sender) requireIsOperational
    requireIsVoter(msg.sender)
                            //returns(bool success, uint256 votes)
    {
        require(airlines[_airline].waitingVotes == false, "Airline is already under registeration process!");
        require(dataContract.isRegisteredAirline(_airline) == false, "Airline is already registered!");
        uint256 regAirlines = dataContract.getRegisteredAirlinesCount();
        // if before reaching voting point, we register the airline right away.
        if (regAirlines < votingLimit)
        {
            dataContract.registerAirline(_airline, _name);
            airlines[_airline] = Airline({
            name: _name,
            waitingVotes: false});
        }
        // if after reaching voting point, we add the airline to the list of airlines waiting for votings.
        else
        {
            airlines[_airline] = Airline({
            name: _name,
            waitingVotes: true
        });
        votesPerAirline[_airline] = new address[](0); //prepare to collect votes
        }
        //return (success, 0);
    }

    // function to fund airline to be qualified to participate in the contract
    // caller must be registered airline to fund itself.
    // the fund must be 10 ethers or more
    function fundAirline() external requireIsOperational requireRegisteredAirline(msg.sender) payable
    {
        //this will fail if fund < 10 ethers in the data contract or if the airline is not registered
        dataContract.fundAirline.value(msg.value)(msg.sender);
        if (dataContract.isFundedAirline(msg.sender))
        {
            voters[msg.sender] = true;      //airline now can vote (after funding)
        }
    }

    // function to vote for new airline to be registered
    // caller must be a qualified voter (funded airline)
    // airline to be registered must be waiting for votes and must not be registered
    // the contract must be in the stage of considering votes (initially after 4 registerations of airlines)
    // the caller must be prevented from double voting for the same airline
    function voteForAirline(address _airline) external requireIsVoter(msg.sender) requireIsOperational requireWaitingVotes(_airline)
    {
        require(dataContract.isRegisteredAirline(_airline) == false, "Airline is already registered!");
        uint256 regAirlines = dataContract.getRegisteredAirlinesCount();
        require (regAirlines >= votingLimit, "Voting is not required at this stage!");
        uint256 votesCount = votingRecords[msg.sender][_airline].vote;
        require (votesCount != 1, "Airline cannot duplicate voting for the same candidate airline!");

        // in this stage we are ready to vote because all validations passed
        votingRecords[msg.sender][_airline].vote = 1;   //set the flag to prevent duplicate voting
        votesPerAirline[_airline].push(msg.sender);     //record the vote to be able to count total votes

        // now we need to check if this vote will be the qualifier of the airline to be registered.
        if (votesPerAirline[_airline].length >= regAirlines.div(2))  //50% as per the rubric
        {
            airlines[_airline].waitingVotes = false;    //airline is not waiting for votes anymore
            dataContract.registerAirline(_airline, airlines[_airline].name);
        }
    }

   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight(string _flight, uint256 _timestamp) external requireIsOperational requireIsVoter(msg.sender)
    {
        bytes32 flightKey = getFlightKey(msg.sender, _flight, _timestamp); //using the function getFlightKey to get the hash
        // prevent duplicate registeration of flights
        require(flights[flightKey].isRegistered == false, "Flight already registered!");
        // register the flight if not already registered.
        flights[flightKey] = Flight({
            isRegistered: true,
            statusCode: STATUS_CODE_UNKNOWN,
            updatedTimestamp: _timestamp,
            airline: msg.sender
        });
        flightPassengers[flightKey] = new address[](0);

    }

    function isRegisteredFlight(string _flight, uint256 _timestamp, address _airline) external view returns (bool)
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _timestamp);
        return flights[flightKey].isRegistered;

    }


    function buyInsurance (address _airline, string _flight, uint256 _timestamp) external payable requireIsOperational
    {
        require (msg.value > 0, "Insufficient fund to buy insurance!");
        require (msg.value <= maxInsurance, "Paid amount exceeds maximum insurance cost!");
        bytes32 flightKey = getFlightKey(_airline, _flight, _timestamp);
        require (flights[flightKey].isRegistered, "Cannot buy insurance for non-registered flight!");
        uint256 insCost;
        (insCost, ) = dataContract.getInsuranceRecord(msg.sender, flightKey);
        require (insCost == 0, "Insurance already exist for this passenger on the selected flight!");

        dataContract.buy.value(msg.value)(msg.sender, flightKey); // buy the insurance
        flightPassengers[flightKey].push(msg.sender);             // passenger is listed for the flight
    }

    function creditInsurees(address _passenger, address _airline, string _flight, uint256 _timestamp) internal requireIsOperational
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _timestamp);
        uint256 insCost;
        (insCost, ) = dataContract.getInsuranceRecord(_passenger, flightKey);
        uint256 amtToCredit = insCost.mul(insuranceRate).div(100);
        dataContract.creditInsurees(_passenger, flightKey, amtToCredit);
    }

    function getPassengerCredit(address _passenger, address _airline, string _flight, uint256 _timestamp) external view returns (uint256 amt)
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _timestamp);
        return dataContract.getPassengerCredit(_passenger, flightKey);
    }

    // function to be called by passenger in order to pay insurance
    function payInsurance(address _airline, string _flight, uint256 _timestamp) external requireIsOperational
    {
        bytes32 flightKey = getFlightKey(_airline, _flight, _timestamp);
        uint256 insAmount;
        (,insAmount ) = dataContract.getInsuranceRecord(msg.sender, flightKey);
        require (insAmount > 0, "No Credit to be Withdrawn!");
        dataContract.pay(msg.sender, flightKey);
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */
    function processFlightStatus
                                (
                                    address airline,
                                    string  flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                internal
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flights[flightKey].statusCode = statusCode;
        //check if it is time to credit insurees (if late because of airline);
        if (statusCode == STATUS_CODE_LATE_AIRLINE)
        {
            for (uint8 i = 0; i < flightPassengers[flightKey].length; i++)
            {
                creditInsurees(flightPassengers[flightKey][i], airline, flight, timestamp);
            }
        }
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        // emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {
            
            oracleResponses[key].isOpen = false;
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);
            
            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
            
            

        }
    }


    function getFlightKey
                        (
                            address airline,
                            string flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns a random uint between 0 and 9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }
}

// FlightSuretyData interface

contract FlightSuretyData {

    function registerAirline(address airlineAddress, string name) external;             //
    function fund(address originAddress) external payable;                              //
    function buy( address _passenger, bytes32 _flight) external payable;                //
    function isRegisteredAirline(address airlineAddress) external view returns (bool);  //
    function isFundedAirline(address airlineAddress) external view returns (bool);      //
    //function firstAirline() external view returns (address);
    function getFundedAirlinesCount() external view returns (uint256);                  //
    function getRegisteredAirlinesCount() external view returns (uint256);              //
    function fundAirline(address airline) external payable;                             //
    function getAirlineInfo(address airline) public view returns (string, bool, bool);  //
    function getInsuranceRecord(address _passenger, bytes32 _flight) external view returns (uint256 cost, uint256 amount); //
    function getPassengerCredit(address _passenger, bytes32 _flight) external view returns (uint256 amt);
    function creditInsurees(address _passenger, bytes32 _flight, uint256 _creditAmount) external; //
    function pay(address _passenger, bytes32 _flight) external;                         //
    function isOperational() public view returns(bool);                                 //


}


