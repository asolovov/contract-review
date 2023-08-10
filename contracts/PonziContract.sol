// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Hi dear candidate!
// Please review the following contract to find the 2 vulnerbilities that
//results in loss of funds.(High/Critical Severity)
// Please write a short description for each vulnerbillity you found alongside
//with a PoC in hardhat/foundry.
// Your PoC submission should be ready to be run without any modification
// Feel free to add additional notes regarding informational/low severity
// findings

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Contract has several bugs, bad implementations and lack of view functions inside
contract PonziContract is ReentrancyGuard, Ownable {

    uint256 private registrationDeadline;

    // We could use that in bugged `joinPonzi` function
    address[] public affiliates_;

    // We dont use that anywhere, but we could use it in `onlyAfilliates` modifier
    mapping(address => bool) public affiliates;

    // Should be the same as `affiliates_.length` so we dont need that
    uint256 public affiliatesCount;

    event RegistrationDeadline(uint256 registrationDeadline);
    event Withdraw(uint256 amount);

    // Strange implementation, we could use just require(affiliates[msg.sender], "...");
    modifier onlyAfilliates() {
        bool affiliate;
        for (uint256 i = 0; i < affiliatesCount; i++) {
            if (affiliates_[i] == msg.sender) {
                affiliate = true;
            }
        }
        require(affiliate == true, "Not an Affiliate!");
        _;
    }

    // Deadline can be already expired when set
    function setDeadline(uint256 _regDeadline) external onlyOwner {
        registrationDeadline = _regDeadline;
        emit RegistrationDeadline(registrationDeadline);
    }

    /**
     * Function have several bug-cases:
     * We can become an Affiliate for free:
     * - We can send empty slice if `affiliatesCount` is 0
     * - We can send our own address if `affiliatesCount` is 1
     * - We can send our own addresses if `affiliatesCount` is more than 1
     *
     * Also:
     * - We can use the function several times with one caller and have duplicated addresses in `affiliates_` slice
     */
    function joinPonzi(
        address[] calldata _afilliates
    ) external payable nonReentrant {
        require(
            block.timestamp < registrationDeadline,
            "Registration not Active!"
        );
        require(_afilliates.length == affiliatesCount, "Invalid length");
        require(msg.value == affiliatesCount * 1 ether, "Insufficient Ether");
        for (uint256 i = 0; i < _afilliates.length; i++) {
            _afilliates[i].call{value: 1 ether}("");
        }
        affiliatesCount += 1;

        affiliates[msg.sender] = true;
        affiliates_.push(msg.sender);
    }

    // Critical bug - no value withdraw to owner. Caller can become an owner for free.
    // Need ownerWithdraw(owner(), msg.value); before transfer
    function buyOwnerRole(address newAdmin) external payable onlyAfilliates {
        require(msg.value == 10 ether, "Invalid Ether amount");
        _transferOwnership(newAdmin);
    }

    function ownerWithdraw(address to, uint256 amount) external onlyOwner {
        payable(to).call{value: amount}("");
        emit Withdraw(amount);
    }

    // Bug - we can add one Affilliate several times
    // Need require(!affiliates[msg.sender], "...");
    function addNewAffilliate(address newAfilliate) external onlyOwner {
        affiliatesCount += 1;
        affiliates[newAfilliate] = true;
        affiliates_.push(newAfilliate);
    }

    receive() external payable {}
}