import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import {
  AddressOne,
  AddressZero,
  getCreate2Address,
  MaxUint256,
  MINIMUM_LIQUIDITY,
  sortTokens,
  toWei,
} from '../utils/shared';
import { BigNumberish } from 'ethers';
import { MockERC20, UniswapV2Pair } from '../../typechain-types';

describe('UniswapV2Router01', () => {
  const deployFixture = async () => {
    const [owner, other] = await ethers.getSigners();
    const UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
    const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair');
    const ERC20 = await ethers.getContractFactory('MockERC20');
    const WETH = await ethers.getContractFactory('WETH9');
    const UniswapV2Router01 = await ethers.getContractFactory('UniswapV2Router01');
    const factory = await UniswapV2Factory.deploy(owner.address);
    const weth = await WETH.deploy();
    const uniswapv2Router01 = await UniswapV2Router01.deploy(factory.address, weth.address);
    let token0 = await ERC20.deploy('Token A', 'TKNA');
    let token1 = await ERC20.deploy('Token B', 'TKNB');
    const wethPartner = await ERC20.deploy('WETH Partner', 'WETHPAR');
    const tokens = sortTokens(token0, token1);
    token0 = tokens[0];
    token1 = tokens[1];
    await factory.createPair(token0.address, token1.address);
    await factory.createPair(weth.address, wethPartner.address);
    const bytecode = UniswapV2Pair.bytecode;
    const create2Address = getCreate2Address(factory.address, [token0.address, token1.address], bytecode);
    const pair = UniswapV2Pair.attach(create2Address);
    const wethPairAddress = getCreate2Address(factory.address, [weth.address, wethPartner.address], bytecode);
    const wethPair = UniswapV2Pair.attach(wethPairAddress);
    return { factory, pair, wethPair, token0, token1, weth, wethPartner, uniswapv2Router01, owner, other };
  };

  it('factory, WETH', async () => {
    const { factory, weth, uniswapv2Router01 } = await loadFixture(deployFixture);
    expect(await uniswapv2Router01.factory()).to.equal(factory.address);
    expect(await uniswapv2Router01.WETH()).to.equal(weth.address);
  });

  it('addLiquidity', async () => {
    const { token0, token1, uniswapv2Router01: router, pair, owner } = await loadFixture(deployFixture);
    const token0Amount = toWei(1);
    const token1Amount = toWei(4);
    const expectedLiquidity = toWei(2);

    await token0.approve(router.address, MaxUint256);
    await token1.approve(router.address, MaxUint256);
    await expect(
      router.addLiquidity(token0.address, token1.address, token0Amount, token1Amount, 0, 0, owner.address, MaxUint256)
    )
      .to.emit(token0, 'Transfer')
      .withArgs(owner.address, pair.address, token0Amount)
      .to.emit(token1, 'Transfer')
      .withArgs(owner.address, pair.address, token1Amount)
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, AddressOne, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, owner.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(router.address, token0Amount, token1Amount);
    expect(await pair.balanceOf(owner.address)).to.equal(expectedLiquidity.sub(MINIMUM_LIQUIDITY));
  });

  it('addLiquidityETH', async () => {
    const { wethPartner, wethPair, owner, uniswapv2Router01: router } = await loadFixture(deployFixture);
    const WETHPartnerAmount = toWei(1);
    const ETHAmount = toWei(4);
    const expectedLiquidity = toWei(2);
    const wethPairToken0 = await wethPair.token0();
    await wethPartner.approve(router.address, MaxUint256);
    await expect(
      router.addLiquidityETH(
        wethPartner.address,
        WETHPartnerAmount,
        WETHPartnerAmount,
        ETHAmount,
        owner.address,
        MaxUint256,
        { value: ETHAmount }
      )
    )
      .to.emit(wethPair, 'Transfer')
      .withArgs(AddressZero, AddressOne, MINIMUM_LIQUIDITY)
      .to.emit(wethPair, 'Transfer')
      .withArgs(AddressZero, owner.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(wethPair, 'Sync')
      .withArgs(
        wethPairToken0 === wethPartner.address ? WETHPartnerAmount : ETHAmount,
        wethPairToken0 === wethPartner.address ? ETHAmount : WETHPartnerAmount
      )
      .to.emit(wethPair, 'Mint')
      .withArgs(
        router.address,
        wethPairToken0 === wethPartner.address ? WETHPartnerAmount : ETHAmount,
        wethPairToken0 === wethPartner.address ? ETHAmount : WETHPartnerAmount
      );
    expect(await wethPair.balanceOf(owner.address)).to.equal(expectedLiquidity.sub(MINIMUM_LIQUIDITY));
  });

  const addLiquidity = async (
    token0Amount: BigNumberish,
    token1Amount: BigNumberish,
    pair: UniswapV2Pair,
    token0: MockERC20,
    token1: MockERC20,
    to: string
  ) => {
    await token0.transfer(pair.address, token0Amount);
    await token1.transfer(pair.address, token1Amount);
    await pair.mint(to);
  };

  it('removeLiquidity', async () => {
    const { token0, token1, pair, owner, uniswapv2Router01: router } = await loadFixture(deployFixture);
    const token0Amount = toWei(1);
    const token1Amount = toWei(4);
    await addLiquidity(token0Amount, token1Amount, pair, token0, token1, owner.address);
    const expectedLiquidity = toWei(2);
    await pair.approve(router.address, MaxUint256);
    await expect(
      router.removeLiquidity(
        token0.address,
        token1.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        owner.address,
        MaxUint256
      )
    )
      .to.emit(pair, 'Transfer')
      .withArgs(owner.address, pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, owner.address, token0Amount.sub(500))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, owner.address, token1Amount.sub(2000))
      .to.emit(pair, 'Sync')
      .withArgs(500, 2000)
      .to.emit(pair, 'Burn')
      .withArgs(router.address, token0Amount.sub(500), token1Amount.sub(2000), owner.address);

    expect(await pair.balanceOf(owner.address)).to.equal(0);
    const totalSupplyToken0 = await token0.totalSupply();
    const totalSupplyToken1 = await token1.totalSupply();
    expect(await token0.balanceOf(owner.address)).to.equal(totalSupplyToken0.sub(500));
    expect(await token1.balanceOf(owner.address)).to.equal(totalSupplyToken1.sub(2000));
  });
});
