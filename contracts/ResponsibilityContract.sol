// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ResponsibilityContract {
    event DecisionLogged(
        bytes32 indexed policyHash,
        bytes32 indexed intentHash,
        uint8 outcome,
        address indexed caller
    );

    function logDecision(bytes32 policyHash, bytes32 intentHash, uint8 outcome) external {
        require(outcome <= 2, "invalid outcome");
        emit DecisionLogged(policyHash, intentHash, outcome, msg.sender);
    }
}
