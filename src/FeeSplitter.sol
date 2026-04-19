// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @notice Accepts a USDC payment, takes 10% platform fee, forwards 90% to recipient.
contract FeeSplitter {
    address public immutable platform;  // receives 10%
    IERC20  public immutable usdc;

    event Payment(address indexed payer, address indexed recipient, uint256 amount, uint256 fee);

    constructor(address _usdc, address _platform) {
        usdc     = IERC20(_usdc);
        platform = _platform;
    }

    /// @param recipient  The service/agent wallet that receives 90%
    /// @param amount     Total USDC amount (6 decimals) the user is paying
    function pay(address recipient, uint256 amount) external {
        uint256 fee = amount / 10;          // 10%
        uint256 net = amount - fee;         // 90%

        require(usdc.transferFrom(msg.sender, platform,  fee), "fee transfer failed");
        require(usdc.transferFrom(msg.sender, recipient, net), "net transfer failed");

        emit Payment(msg.sender, recipient, net, fee);
    }
}
