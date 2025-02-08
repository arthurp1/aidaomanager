// SPDX-License-Identifier: MIT


// contracts/DAOGovernance.sol
pragma solidity ^0.8.17;

import "./interfaces/IDAO.sol";

contract DAOGovernance is IDAO {
    struct Proposal {
        uint256 id;
        string description;
        uint256 votes;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    function createProposal(string memory description) external override {
        proposalCount++;
        proposals[proposalCount] = Proposal(proposalCount, description, 0, false);
    }

    function vote(uint256 proposalId) external override {
        require(proposalId <= proposalCount, "Invalid proposal ID");
        proposals[proposalId].votes++;
    }
}