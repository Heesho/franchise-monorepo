// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDONUT is ERC20 {
    constructor() ERC20("Mock Donut", "DONUT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
