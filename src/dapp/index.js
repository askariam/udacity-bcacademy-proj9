
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error, result);
            display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }]);
        });


        // Dynamically fill the drop down list with the available flights
        let sel = DOM.elid('flight-number');
        for (let i = 0; i < contract.flights.length; i++) {
            var option = document.createElement('option');
            option.text = contract.flights[i].flight;
            option.value = i; // value is the flight index and we can read its data (flight object) later
            sel.add(option);
        }

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            // contract.flights[flight] returns the flight object
            contract.fetchFlightStatus(contract.flights[flight], (error, result) => {
                display('Oracles', 'Trigger oracles', [{ label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp }]);
            });
        })

        // user buy insurance
        DOM.elid('buy-ins').addEventListener('click', () => {
            let ethers = DOM.elid('ethers').value;
            ethers = ethers.trim();

            // validate ethers input to be a valid number
            let err = false;
            if (ethers.length == 0 || ethers == ".") {
                err = true;
                alert("Ethers cannot be blank")
            }
            else {
                let dotCount = 0;
                for (let i = 0; i < ethers.length; i++) {
                    if (ethers[i] == '0' || ethers[i] == '1' || ethers[i] == '2' || ethers[i] == '3' || ethers[i] == '4' || ethers[i] == '5' ||
                        ethers[i] == '6' || ethers[i] == '7' || ethers[i] == '8' || ethers[i] == '9' || ethers[i] == '.') {
                        if (ethers[i] == '.') {
                            ++dotCount;
                            if (dotCount > 1) {
                                err = true;
                                alert("Incorrect input!");
                                break;

                            }
                        }
                        continue;
                    }
                    else {
                        err = true;
                        alert("Incorrect input!");
                        break;
                    }
                }
            }

            // if we got valid ether input, we can start the process of buying insurance
            if (!err) {
                if (ethers[0] == ".") {
                    ethers = "0" + ethers;
                }
                if (ethers[ethers.length - 1] == ".") {
                    ethers = ethers + "0";
                }
                let flight = DOM.elid('flight-number').value;
                contract.buyInsurance(contract.flights[flight], ethers, (error, result) => {
                    if (error) {
                        display('Buy Insurance', '', [{ label: 'Insurance Status', error: error, value: '' }]);
                    }
                    else {
                        //console.log(result);
                        display('Buy Insurance', '', [{
                            label: 'Insurance Status', error: '',
                            value: `Successful Insurance for flight ${result.flight} with value ${contract.web3.utils.fromWei(result.ethers, "ether")} Ether`
                        }]);
                    }
                })
            }

        });

        // to register/subscribe for the FlightStatusInfo event in the contract -> to be used to update status on the screen
        contract.receiveFlightStatus((error, flightInfo) => {
            if (error) {
                display('Flight Info', 'Oracle Responses Result', [{ label: 'Flight Status', error: error, value: '' }]);
            }
            else {
                display('Flight Info', 'Oracle Responses Result', [{
                    label: 'Fligh Status', error: '',
                    value: `Status of Flight: ${flightInfo.flight} is ${flightInfo.statusText}`
                }]);
            }

        });

    });

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({ className: 'row' }));
        row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label));
        row.appendChild(DOM.div({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}
