import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Rig__Mined as RigMinedEvent,
  Rig__PreviousMinerFee as RigPreviousMinerFeeEvent,
  Rig__Minted as RigMintedEvent,
  Rig__TreasuryFee as RigTreasuryFeeEvent,
  Rig__TeamFee as RigTeamFeeEvent,
  Rig__ProtocolFee as RigProtocolFeeEvent,
  Rig__TreasurySet as RigTreasurySetEvent,
  Rig__TeamSet as RigTeamSetEvent,
  Rig__UriSet as RigUriSetEvent,
} from "../generated/templates/Rig/Rig";
import { Launchpad, Rig, Account, RigAccount, Epoch } from "../generated/schema";
import { ZERO_BD, ZERO_BI, ONE_BI, LAUNCHPAD_ID, ADDRESS_ZERO } from "./constants";
import { convertTokenToDecimal } from "./helpers";

function getOrCreateRig(rigAddress: string): Rig {
  let rig = Rig.load(rigAddress);
  if (rig == null) {
    // This shouldn't happen if Core__Launched was processed first
    rig = new Rig(rigAddress);
    rig.launchpad = LAUNCHPAD_ID;
    rig.launcher = ADDRESS_ZERO;
    rig.unit = Bytes.empty();
    rig.auction = Bytes.empty();
    rig.lpToken = Bytes.empty();
    rig.tokenName = "";
    rig.tokenSymbol = "";
    rig.uri = "";
    // Launch parameters (defaults)
    rig.initialUps = ZERO_BI;
    rig.tailUps = ZERO_BI;
    rig.halvingPeriod = ZERO_BI;
    rig.rigEpochPeriod = ZERO_BI;
    rig.rigPriceMultiplier = ZERO_BD;
    rig.rigMinInitPrice = ZERO_BD;
    // Runtime state
    rig.epochId = ZERO_BI;
    rig.revenue = ZERO_BD;
    rig.teamRevenue = ZERO_BD;
    rig.minted = ZERO_BD;
    rig.lastMined = ZERO_BI;
    rig.createdAt = ZERO_BI;
    rig.createdAtBlock = ZERO_BI;
  }
  return rig;
}

function getOrCreateAccount(address: string): Account {
  let account = Account.load(address);
  if (account == null) {
    account = new Account(address);
    account.save();
  }
  return account;
}

function getRigAccountId(rigAddress: string, accountAddress: string): string {
  return rigAddress + "-" + accountAddress;
}

function getOrCreateRigAccount(rigAddress: string, accountAddress: string): RigAccount {
  let id = getRigAccountId(rigAddress, accountAddress);
  let rigAccount = RigAccount.load(id);
  if (rigAccount == null) {
    // Ensure Account exists
    getOrCreateAccount(accountAddress);

    rigAccount = new RigAccount(id);
    rigAccount.rig = rigAddress;
    rigAccount.account = accountAddress;
    rigAccount.spent = ZERO_BD;
    rigAccount.earned = ZERO_BD;
    rigAccount.mined = ZERO_BD;
  }
  return rigAccount;
}

function getEpochId(rigAddress: string, epochId: BigInt): string {
  return rigAddress + "-" + epochId.toString();
}

function getOrCreateEpoch(rigAddress: string, epochId: BigInt, accountAddress: string): Epoch {
  let id = getEpochId(rigAddress, epochId);
  let epoch = Epoch.load(id);
  if (epoch == null) {
    let rigAccountId = getRigAccountId(rigAddress, accountAddress);
    // Ensure RigAccount exists
    let rigAccount = getOrCreateRigAccount(rigAddress, accountAddress);
    rigAccount.save();

    epoch = new Epoch(id);
    epoch.rig = rigAddress;
    epoch.rigAccount = rigAccountId;
    epoch.uri = "";
    epoch.startTime = ZERO_BI;
    epoch.initPrice = ZERO_BD;
    epoch.mined = ZERO_BD;
    epoch.spent = ZERO_BD;
    epoch.earned = ZERO_BD;
  }
  return epoch;
}

export function handleRigMined(event: RigMinedEvent): void {
  let rigAddress = event.address.toHexString();
  let minerAddress = event.params.miner.toHexString();

  let rig = getOrCreateRig(rigAddress);
  rig.epochId = rig.epochId.plus(ONE_BI);
  rig.lastMined = event.block.timestamp;
  rig.save();

  // Update miner's rig account (the one who paid to mine)
  let rigAccount = getOrCreateRigAccount(rigAddress, minerAddress);
  let price = convertTokenToDecimal(event.params.price, BigInt.fromI32(18));
  rigAccount.spent = rigAccount.spent.plus(price);
  rigAccount.save();

  // Create/update epoch
  let epoch = getOrCreateEpoch(rigAddress, rig.epochId, minerAddress);
  epoch.rigAccount = getRigAccountId(rigAddress, minerAddress);
  epoch.uri = event.params.uri;
  epoch.startTime = event.block.timestamp;
  epoch.spent = price;
  epoch.save();
}

export function handleRigPreviousMinerFee(event: RigPreviousMinerFeeEvent): void {
  let rigAddress = event.address.toHexString();
  let minerAddress = event.params.miner.toHexString();
  let rig = getOrCreateRig(rigAddress);

  // Update previous miner's earned amount on this rig
  let rigAccount = getOrCreateRigAccount(rigAddress, minerAddress);
  let amount = convertTokenToDecimal(event.params.amount, BigInt.fromI32(18));
  rigAccount.earned = rigAccount.earned.plus(amount);
  rigAccount.save();

  // Update the current epoch's earned (fee paid to previous holder during this epoch's mine)
  if (rig.epochId.gt(ZERO_BI)) {
    let epoch = Epoch.load(getEpochId(rigAddress, rig.epochId));
    if (epoch != null) {
      epoch.earned = epoch.earned.plus(amount);
      epoch.save();
    }
  }
}

export function handleRigMinted(event: RigMintedEvent): void {
  let rigAddress = event.address.toHexString();
  let minerAddress = event.params.miner.toHexString();

  let rig = getOrCreateRig(rigAddress);
  let amount = convertTokenToDecimal(event.params.amount, BigInt.fromI32(18));
  rig.minted = rig.minted.plus(amount);
  rig.save();

  // Update launchpad totals
  let launchpad = Launchpad.load(LAUNCHPAD_ID);
  if (launchpad != null) {
    launchpad.totalMinted = launchpad.totalMinted.plus(amount);
    launchpad.save();
  }

  // Update miner's mined amount on this rig
  let rigAccount = getOrCreateRigAccount(rigAddress, minerAddress);
  rigAccount.mined = rigAccount.mined.plus(amount);
  rigAccount.save();

  // Update epoch mined amount
  if (rig.epochId.gt(ZERO_BI)) {
    let epoch = Epoch.load(getEpochId(rigAddress, rig.epochId));
    if (epoch != null) {
      epoch.mined = epoch.mined.plus(amount);
      epoch.save();
    }
  }
}

export function handleRigTreasuryFee(event: RigTreasuryFeeEvent): void {
  let rigAddress = event.address.toHexString();
  let rig = getOrCreateRig(rigAddress);
  let amount = convertTokenToDecimal(event.params.amount, BigInt.fromI32(18));
  rig.revenue = rig.revenue.plus(amount);
  rig.save();

  // Update launchpad totals
  let launchpad = Launchpad.load(LAUNCHPAD_ID);
  if (launchpad != null) {
    launchpad.totalRevenue = launchpad.totalRevenue.plus(amount);
    launchpad.save();
  }
}

export function handleRigTeamFee(event: RigTeamFeeEvent): void {
  let rigAddress = event.address.toHexString();
  let rig = getOrCreateRig(rigAddress);
  let amount = convertTokenToDecimal(event.params.amount, BigInt.fromI32(18));
  rig.teamRevenue = rig.teamRevenue.plus(amount);
  rig.save();
}

export function handleRigProtocolFee(event: RigProtocolFeeEvent): void {
  let amount = convertTokenToDecimal(event.params.amount, BigInt.fromI32(18));

  // Update launchpad protocol revenue (platform revenue)
  let launchpad = Launchpad.load(LAUNCHPAD_ID);
  if (launchpad != null) {
    launchpad.protocolRevenue = launchpad.protocolRevenue.plus(amount);
    launchpad.save();
  }
}

export function handleRigTreasurySet(event: RigTreasurySetEvent): void {
  // Treasury address changed - no state update needed
}

export function handleRigTeamSet(event: RigTeamSetEvent): void {
  // Team address changed - no state update needed
}

export function handleRigUriSet(event: RigUriSetEvent): void {
  let rigAddress = event.address.toHexString();
  let rig = getOrCreateRig(rigAddress);
  rig.uri = event.params.uri;
  rig.save();
}
