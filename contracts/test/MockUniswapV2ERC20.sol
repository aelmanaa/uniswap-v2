// SPDX-License-Identifier: unlicense
pragma solidity ^0.8.17;

import "../core/UniswapV2ERC20.sol";

contract MockUniswapV2ERC20 is UniswapV2ERC20 {
    constructor(uint256 _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
