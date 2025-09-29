// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CredentialRegistry {
    struct Credential {
        address owner;
        address issuer;
        string ipfsHash;
        string credentialType;
        uint256 timestamp;
    }

    mapping(bytes32 => Credential) private credentials;

    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed owner,
        address indexed issuer,
        string credentialType
    );

    function issueCredential(
        address _owner,
        string memory _ipfsHash,
        string memory _credentialType
    ) public returns (bytes32) {
        bytes32 credentialId = keccak256(
            abi.encodePacked(msg.sender, _owner, _ipfsHash, _credentialType, block.timestamp)
        );

        credentials[credentialId] = Credential({
            owner: _owner,
            issuer: msg.sender,
            ipfsHash: _ipfsHash,
            credentialType: _credentialType,
            timestamp: block.timestamp
        });

        emit CredentialIssued(credentialId, _owner, msg.sender, _credentialType);
        return credentialId;
    }

    function verifyCredential(bytes32 _credentialId)
        public
        view
        returns (address owner, string memory ipfsHash, string memory credentialType, uint256 timestamp, address issuer)
    {
        Credential memory c = credentials[_credentialId];
        require(c.owner != address(0), "Credential does not exist");
        return (c.owner, c.ipfsHash, c.credentialType, c.timestamp, c.issuer);
    }
}