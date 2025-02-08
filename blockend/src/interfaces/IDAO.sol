// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IDAO {
  
    event ProposalCreated(uint256 indexed proposalId, string description);
    event Voted(uint256 indexed proposalId, address indexed voter, uint256 votes);

    
    function createProposal(string memory description) external;
    function vote(uint256 proposalId) external;

    
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        string memory description,
        uint256 votes,
        bool executed
    );

    function getProposalCount() external view returns (uint256);
}