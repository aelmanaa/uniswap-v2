import { BigNumber, BigNumberish, utils, constants } from 'ethers';
import { keccak256, defaultAbiCoder, solidityPack, toUtf8Bytes, getAddress, BytesLike } from 'ethers/lib/utils';
import { ERC20 } from '../../typechain-types';

export const bigNumberify = (value: BigNumberish) => BigNumber.from(value);

export const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3);

export const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

export const getDomainSeparator = (name: string, tokenAddress: string, chainId: number) => {
  return keccak256(
    defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        chainId,
        tokenAddress,
      ]
    )
  );
};

export type Approval = {
  owner: string;
  spender: string;
  value: BigNumberish;
};

export const getApprovalDigest = async (
  token: ERC20,
  approve: Approval,
  nonce: BigNumber,
  deadline: BigNumber,
  chainId: number
) => {
  const name = await token.name();
  const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address, chainId);
  return keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        ),
      ]
    )
  );
};

export const sortTokensAddresses = (...adddresses: string[]) => [...adddresses].sort((t1, t2) => (t1 < t2 ? -1 : 1));
export const sortTokens = (...tokens: ERC20[]) => [...tokens].sort((t1, t2) => (t1.address < t2.address ? -1 : 1));

export const getCreate2Address = (factoryAddress: string, [tokenA, tokenB]: [string, string], bytecode: BytesLike) => {
  const [token0, token1] = sortTokensAddresses(tokenA, tokenB);
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPack(['address', 'address'], [token0, token1])),
    keccak256(bytecode),
  ];
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`;
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`);
};

export const TWO_POW112 = bigNumberify(2).pow(112);
export const encodePrice = (reserve0: BigNumberish, reserve1: BigNumberish) => {
  const reserve0BN = bigNumberify(reserve0),
    reserve1BN = bigNumberify(reserve1);
  return [reserve1BN.mul(TWO_POW112).div(reserve0BN), reserve0BN.mul(TWO_POW112).div(reserve1BN)];
};

export const getAmount = (inputAmount: BigNumberish, inputReserve: BigNumberish, outputReserve: BigNumberish) => {
  // constant product function used for pricing
  const inputAmountBN = bigNumberify(inputAmount),
    inputReserveBN = bigNumberify(inputReserve),
    outputReserveBN = bigNumberify(outputReserve);
  const inputAmountLessFees = inputAmountBN.mul(997).div(1000);
  return inputAmountLessFees.mul(outputReserveBN).div(inputReserveBN.add(inputAmountLessFees));
};

export const toWei = (value: BigNumberish) => utils.parseEther(value.toString());
export const AddressZero = constants.AddressZero;
export const AddressOne = '0x0000000000000000000000000000000000000001';
