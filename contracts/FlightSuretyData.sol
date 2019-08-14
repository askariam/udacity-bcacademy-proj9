pragma solidity ^0.4.25;
// pragma solidity ^0.5.2;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;  // always use SafeMath library

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => bool) private allowedCallers;                    // App contracts that can call this data contract

    // Airline struct
    struct Airline {
        string name;
        bool isFunded;
        bool isRegistered;
    }

    mapping(address => Airline) public airlines;                        // list (mapping) of airlines
    address[] registeredAirlines = new address[](0);                    // keep track of registered airlines
    address[] fundedAirlines = new address[](0);                        // keep track of funded airlines


    //Insurance Record struct
    struct InsuranceRecord {
        uint256 insuranceCost;
        uint256 insuranceAmount;
    }

    // mapping passenger to flights insurance records
    mapping (address => mapping(bytes32 => InsuranceRecord)) passengersInsRecords;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event PassengerPaid(address recipient, bytes32 flight, uint256 amount);
    event AirlineFunded(address airline, string name);
    event AirlineRegistered(address newAirline, string name);
    event PassengerCredited(address passenger, bytes32 flight, uint256 amount);
    event InsuranceRecorded(address passenger, bytes32 flight, uint256 cost);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address _firstAirlineAddress, string _firstAirlineName) public
    {
        contractOwner = msg.sender;
        // Rubric Requirements -> 1st Airline is registered upon deployment
        airlines[_firstAirlineAddress] = Airline({
            name: _firstAirlineName,
            isFunded: false,
            isRegistered:  true
        });
        registeredAirlines.push(_firstAirlineAddress);
        emit AirlineRegistered(_firstAirlineAddress, _firstAirlineName);
    }

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
        require(operational, "Contract is currently not operational");
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

    // Modifier that requires the caller to be pre-authorized => allowedCallers[address] = true
    modifier requireCallerAuthorized() {
        require(allowedCallers[msg.sender] == true, "Address not authorized!");
        _;
    }


    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */

    function isOperational() public view returns(bool)
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */

    function setOperatingStatus(bool mode) external requireContractOwner
    {
        operational = mode;
    }


    // this function adds the address in the arguments as allowed caller to this data contract
    function authorizeCaller (address _appContract) external requireContractOwner
    {
        allowedCallers[_appContract] = true;
    }

    // this function removes/blocks the address in the arguments from the allowed list of callers
    function deauthorizeCaller (address _appContract) external requireContractOwner
    {
        require (allowedCallers[_appContract] == true, "Caller is already blocked!");
        delete allowedCallers[_appContract];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */

    function registerAirline(address _airlineAddress,string _airlineName) external requireIsOperational requireCallerAuthorized
    {
        airlines[_airlineAddress] = Airline({
            name: _airlineName,
            isFunded: false,
            isRegistered: true
        });
        registeredAirlines.push(_airlineAddress);
        emit AirlineRegistered(_airlineAddress, _airlineName);
    }

    // funding an airline with 10 ethers to start participating in the contract (Rubric requirements)
    function fundAirline( address _airlineAddress) external payable requireIsOperational requireCallerAuthorized
    {
        require (airlines[_airlineAddress].isRegistered, "Airline is not registered yet!"); //only registered airline can be funded
        require (msg.value >= 10 ether, "Insufficient Fund! Please fund with 10 ethers and more"); //fund must be 10 ethers
        airlines[_airlineAddress].isFunded = true;
        fundedAirlines.push(_airlineAddress);
        emit AirlineFunded(_airlineAddress, airlines[_airlineAddress].name);
    }

    // Helper function to support the logic of voting later in the App contract
    // returns count of registered airlines
    function getRegisteredAirlinesCount() external view  returns (uint256 cnt)
    {
        cnt = registeredAirlines.length;
    }

    // Helper function to support the logic of voting later in the App contract
    // returns  count of funded airlines
    function getFundedAirlinesCount()  external view returns (uint256 cnt)
    {
        cnt = fundedAirlines.length;
    }

    function getInsuranceRecord(address _passenger, bytes32 _flight) external view returns (uint256 cost, uint256 amount)
    {
        //require (passengersInsRecords[_passenger][_flight].insuranceCost > 0, "No insurance found!");
        return (passengersInsRecords[_passenger][_flight].insuranceCost, passengersInsRecords[_passenger][_flight].insuranceAmount);
    }

    function getAirlineInfo(address _airlineAddress) external view returns (string name, bool isReg, bool isFund)
    {
        require (airlines[_airlineAddress].isRegistered,"Airline not found!");
        return (airlines[_airlineAddress].name, airlines[_airlineAddress].isRegistered, airlines[_airlineAddress].isFunded);
    }

    function isRegisteredAirline(address _airline) external view returns (bool isReg)
    {
        return airlines[_airline].isRegistered;
    }

    function isFundedAirline(address _airline) external view returns (bool isFund)
    {
        return airlines[_airline].isFunded;
    }
   /**
    * @dev Buy insurance for a flight
    *
    */

    function buy( address _passenger, bytes32 _flight) external payable requireIsOperational requireCallerAuthorized
    {
        // initialize the passenger insurance with the amount paid by passenger
        // the insurance benefit is calculated later in x1.5 rate
        passengersInsRecords[_passenger][_flight] = InsuranceRecord({insuranceCost: msg.value, insuranceAmount: 0 ether});
        emit InsuranceRecorded(_passenger, _flight, msg.value);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address _passenger, bytes32 _flight, uint256 _creditAmount)
                                external requireIsOperational requireCallerAuthorized
    {
        // this logic allows the business rules to change in the App contract.
        // if we need to change the rate of x1.5, we can do it there.
        passengersInsRecords[_passenger][_flight].insuranceAmount = _creditAmount;
        emit PassengerCredited(_passenger, _flight, _creditAmount);
    }

    function getPassengerCredit(address _passenger, bytes32 _flight) external view  requireCallerAuthorized returns (uint256 amt) 
    {
        return passengersInsRecords[_passenger][_flight].insuranceAmount;
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address _passenger, bytes32 _flight) external requireIsOperational requireCallerAuthorized
    {
        // get the amount to paid from the insurance record
        uint256 amt = passengersInsRecords[_passenger][_flight].insuranceAmount;
        require (amt > 0, "Passenger not eligible for insurance for this flight. Or already paid!");
        // in this stage, start the payment by taking the amount
        passengersInsRecords[_passenger][_flight].insuranceAmount = 0;
        _passenger.transfer(amt);
        emit PassengerPaid(_passenger, _flight, amt);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund( ) public payable
    {

    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) internal pure returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable
    {
        fund();
    }


}

