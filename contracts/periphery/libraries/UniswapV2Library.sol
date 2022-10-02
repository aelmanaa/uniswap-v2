// SPDX-License-Identifier: unlicense
pragma solidity ^0.8.17;
import "../../core/interfaces/IUniswapV2Pair.sol";

library UniswapV2Library {
    error UniswapV2Library_IDENTITICAL_ADDRESSES(
        address tokenA,
        address tokenB
    );
    error UniswapV2Library_ZERO_ADDRESS();
    error UniswapV2Library_INSUFFICIENT_AMOUNT();
    error UniswapV2Library_INSUFFICIENT_LIQUIDITY();
    error UniswapV2Library_INSUFFICIENT_INPUT_AMOUNT();
    error UniswapV2Library_INSUFFICIENT_OUTPUT_AMOUNT();
    error UniswapV2Library_INVALID_PATH(address[] path);
    error UniswapV2Library_SendingEthFailed(
        address receiver,
        uint256 ethAmount
    );

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        if (tokenA == tokenB)
            revert UniswapV2Library_IDENTITICAL_ADDRESSES(tokenA, tokenB);
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        if (token0 == address(0)) revert UniswapV2Library_ZERO_ADDRESS();
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(
        address factory,
        address tokenA,
        address tokenB
    ) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff",
                            factory,
                            keccak256(abi.encodePacked(token0, token1)),
                            hex"9c34ce45d92a14ff3c7ccab22f0573890919ad7d806c1865e525ec3d73a409e0" // init code hash
                        )
                    )
                )
            )
        );
    }

    // fetches and sorts the reserves for a pair
    function getReserves(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(
            pairFor(factory, tokenA, tokenB)
        ).getReserves();
        (reserveA, reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountB) {
        if (amountA == 0) revert UniswapV2Library_INSUFFICIENT_AMOUNT();
        if (reserveA == 0 || reserveB == 0)
            revert UniswapV2Library_INSUFFICIENT_LIQUIDITY();
        amountB = (amountA * reserveB) / reserveA;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        if (amountIn == 0) revert UniswapV2Library_INSUFFICIENT_INPUT_AMOUNT();
        if (reserveIn == 0 || reserveOut == 0)
            revert UniswapV2Library_INSUFFICIENT_LIQUIDITY();
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        if (amountOut == 0)
            revert UniswapV2Library_INSUFFICIENT_OUTPUT_AMOUNT();
        if (reserveIn == 0 || reserveOut == 0)
            revert UniswapV2Library_INSUFFICIENT_LIQUIDITY();
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }

    // performs chained getAmountOut calculations on any number of pairs
    function getAmountsOut(
        address factory,
        uint256 amountIn,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        if (path.length < 2) revert UniswapV2Library_INVALID_PATH(path);
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(
                factory,
                path[i],
                path[i + 1]
            );
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // performs chained getAmountIn calculations on any number of pairs
    function getAmountsIn(
        address factory,
        uint256 amountOut,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        if (path.length < 2) revert UniswapV2Library_INVALID_PATH(path);
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = getReserves(
                factory,
                path[i - 1],
                path[i]
            );
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    function safeTransferETH(address receiver, uint256 ethAmount) internal {
        (bool sent, ) = receiver.call{value: ethAmount}("");
        if (!sent)
            revert UniswapV2Library_SendingEthFailed(receiver, ethAmount);
    }
}
