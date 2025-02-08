// SPDX-License-Identifier: MIT


// scripts/DeployDAOToken.s.sol
pragma solidity ^0.8.17;

import "../contracts/DAOToken.sol";

contract DeployDAOToken {
    function run() external {
        new DAOToken(1000000 * 10 ** 18);
    }
}