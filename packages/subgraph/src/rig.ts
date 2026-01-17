import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Rig__Mine as RigMineEvent,
  Rig__MinerFee as RigMinerFeeEvent,
  Rig__Mint as RigMintEvent,
  Rig__TreasuryFee as RigTreasuryFeeEvent,
  Rig__TeamFee as RigTeamFeeEvent,
  Rig__ProtocolFee as RigProtocolFeeEvent,
  Rig__TreasurySet as RigTreasurySetEvent,
  Rig__TeamSet as RigTeamSetEvent,
  Rig__CapacitySet as RigCapacitySetEvent,
  Rig__UriSet as RigUriSetEvent,
} from "../generated/templates/Rig/Rig";
import { Launchpad, Rig, Slot, Account, RigAccount, Epoch, Mine } from "../generated/schema";
import { ZERO_BD, ZERO_BI, ONE_BI, LAUNCHPAD_ID, ADDRESS_ZERO } from "./constants";
import { convertTokenToDecimal } from "./helpers";

// Quote token decimals (USDC = 6)
const QUOTE_DECIMALS = BigInt.fromI32(6);

function getOrCreateRig(rigAddress: string): Rig {
  let rig = Rig.load(rigAddress);
  if (rig == null) {
    // This shouldn't happen if Core__Launched was processed first
    rig = new Rig(rigAddress);
    rig.launchpad = LAUNCHPAD_ID;
    rig.launcher = ADDRESS_ZERO;
    rig.unit = Bytes.empty();
    rig.quoteToken = Bytes.empty();
    rig.auction = Bytes.empty();
    rig.lpToken = Bytes.empty();
    rig.tokenName = "";
    rig.tokenSymbol = "";
    rig.uri = "";
    // Launch parameters (defaults)
    rig.initialUps = ZERO_BI;
    rig.tailUps = ZERO_BI;
    rig.halvingAmount = ZERO_BI;
    rig.rigEpochPeriod = ZERO_BI;
    rig.rigPriceMultiplier = ZERO_BD;
    rig.rigMinInitPrice = ZERO_BD;
    // Runtime state
    rig.capacity = ONE_BI;
    rig.revenue = ZERO_BD;
    rig.teamRevenue = ZERO_BD;
    rig.minted = ZERO_BD;
    rig.lastMined = ZERO_BI;
    rig.createdAt = ZERO_BI;
    rig.createdAtBlock = ZERO_BI;
  }
  return rig;
}

function getSlotId(rigAddress: string, index: BigInt): string {
  return rigAddress + "-" + index.toString();
}

function getOrCreateSlot(rigAddress: string, index: BigInt): Slot {
  let id = getSlotId(rigAddress, index);
  let slot = Slot.load(id);
  if (slot == null) {
    slot = new Slot(id);
    slot.rig = rigAddress;
    slot.index = index;
    slot.epochId = ZERO_BI;
    slot.currentMiner = null;
    slot.uri = "";
    slot.minted = ZERO_BD;
    slot.lastMined = ZERO_BI;
  }
  return slot;
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

function getEpochId(rigAddress: string, index: BigInt, epochId: BigInt): string {
  return rigAddress + "-" + index.toString() + "-" + epochId.toString();
}

function getMineId(rigAddress: string, index: BigInt, epochId: BigInt): string {
  return rigAddress + "-" + index.toString() + "-" + epochId.toString();
}

function getOrCreateEpoch(rigAddress: string, index: BigInt, epochId: BigInt, accountAddress: string): Epoch {
  let id = getEpochId(rigAddress, index, epochId);
  let epoch = Epoch.load(id);
  if (epoch == null) {
    let slotId = getSlotId(rigAddress, index);
    let rigAccountId = getRigAccountId(rigAddress, accountAddress);
    // Ensure RigAccount exists
    let rigAccount = getOrCreateRigAccount(rigAddress, accountAddress);
    rigAccount.save();

    epoch = new Epoch(id);
    epoch.rig = rigAddress;
    epoch.slot = slotId;
    epoch.rigAccount = rigAccountId;
    epoch.index = index;
    epoch.epochId = epochId;
    epoch.uri = "";
    epoch.startTime = ZERO_BI;
    epoch.mined = ZERO_BD;
    epoch.spent = ZERO_BD;
    epoch.earned = ZERO_BD;
  }
  return epoch;
}

export function handleRigMine(event: RigMineEvent): void {
  let rigAddress = event.address.toHexString();
  let minerAddress = event.params.miner.toHexString();
  let index = event.params.index;
  let epochId = event.params.epochId;

  // Get the previous miner before updating slot
  let slot = getOrCreateSlot(rigAddress, index);
  let prevMinerAddress = slot.currentMiner;

  // Update rig
  let rig = getOrCreateRig(rigAddress);
  rig.lastMined = event.block.timestamp;
  rig.save();

  // Update slot - Increment epoch for this slot (epochId in event is the OLD epoch being mined out)
  slot.epochId = epochId.plus(ONE_BI);
  slot.currentMiner = minerAddress;
  slot.uri = event.params.uri;
  slot.lastMined = event.block.timestamp;
  slot.save();

  // Update miner's rig account (the one who paid to mine)
  let rigAccount = getOrCreateRigAccount(rigAddress, minerAddress);
  let price = convertTokenToDecimal(event.params.price, QUOTE_DECIMALS);
  rigAccount.spent = rigAccount.spent.plus(price);
  rigAccount.save();

  // Create/update epoch (use the NEW epoch id)
  let newEpochId = epochId.plus(ONE_BI);
  let epoch = getOrCreateEpoch(rigAddress, index, newEpochId, minerAddress);
  epoch.rigAccount = getRigAccountId(rigAddress, minerAddress);
  epoch.uri = event.params.uri;
  epoch.startTime = event.block.timestamp;
  epoch.spent = price;
  epoch.save();

  // Ensure Account exists for the miner
  getOrCreateAccount(minerAddress);

  // Create Mine event for activity feed (keyed by rig-slot-epoch for aggregation)
  let mineId = getMineId(rigAddress, index, newEpochId);
  let mine = new Mine(mineId);
  mine.rig = rigAddress;
  mine.miner = minerAddress;
  mine.prevMiner = prevMinerAddress; // Previous miner who got displaced
  mine.slotIndex = index;
  mine.epochId = newEpochId;
  mine.uri = event.params.uri;
  mine.price = price;
  mine.mined = ZERO_BD; // Will be updated by Rig__Mint event
  mine.earned = ZERO_BD; // Will be updated by Rig__MinerFee event
  mine.upsMultiplier = null; // Will be updated by Rig__UpsMultiplierSet event if applicable
  mine.timestamp = event.block.timestamp;
  mine.blockNumber = event.block.number;
  mine.save();
}

export function handleRigMinerFee(event: RigMinerFeeEvent): void {
  let rigAddress = event.address.toHexString();
  let minerAddress = event.params.miner.toHexString();
  let index = event.params.index;
  let epochId = event.params.epochId;

  // Update previous miner's earned amount on this rig
  let rigAccount = getOrCreateRigAccount(rigAddress, minerAddress);
  let amount = convertTokenToDecimal(event.params.amount, QUOTE_DECIMALS);
  rigAccount.earned = rigAccount.earned.plus(amount);
  rigAccount.save();

  // Update the epoch's earned (fee paid to previous holder)
  // This event is emitted during the mine of epoch N, so the new epoch is N+1
  let newEpochId = epochId.plus(ONE_BI);
  let epoch = Epoch.load(getEpochId(rigAddress, index, newEpochId));
  if (epoch != null) {
    epoch.earned = epoch.earned.plus(amount);
    epoch.save();
  }

  // Update the Mine entity with earned amount
  let mine = Mine.load(getMineId(rigAddress, index, newEpochId));
  if (mine != null) {
    mine.earned = mine.earned.plus(amount);
    mine.save();
  }
}

export function handleRigMint(event: RigMintEvent): void {
  let rigAddress = event.address.toHexString();
  let minerAddress = event.params.miner.toHexString();
  let index = event.params.index;
  let epochId = event.params.epochId;

  let amount = convertTokenToDecimal(event.params.amount, BigInt.fromI32(18));

  // Update rig totals
  let rig = getOrCreateRig(rigAddress);
  rig.minted = rig.minted.plus(amount);
  rig.save();

  // Update slot minted
  let slot = getOrCreateSlot(rigAddress, index);
  slot.minted = slot.minted.plus(amount);
  slot.save();

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

  // Update epoch minted amount
  // This is for the OLD epoch that just ended (epochId in event)
  // But the miner who receives tokens is from that epoch, so we update their epoch
  let epoch = Epoch.load(getEpochId(rigAddress, index, epochId));
  if (epoch != null) {
    epoch.mined = epoch.mined.plus(amount);
    epoch.save();
  }

  // Update the Mine entity with mined amount
  // The new epoch is epochId + 1 (since Mint is for the OLD epoch)
  let newEpochId = epochId.plus(ONE_BI);
  let mine = Mine.load(getMineId(rigAddress, index, newEpochId));
  if (mine != null) {
    mine.mined = mine.mined.plus(amount);
    mine.save();
  }
}

export function handleRigTreasuryFee(event: RigTreasuryFeeEvent): void {
  let rigAddress = event.address.toHexString();
  let rig = getOrCreateRig(rigAddress);
  let amount = convertTokenToDecimal(event.params.amount, QUOTE_DECIMALS);
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
  let amount = convertTokenToDecimal(event.params.amount, QUOTE_DECIMALS);
  rig.teamRevenue = rig.teamRevenue.plus(amount);
  rig.save();
}

export function handleRigProtocolFee(event: RigProtocolFeeEvent): void {
  let amount = convertTokenToDecimal(event.params.amount, QUOTE_DECIMALS);

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

export function handleRigCapacitySet(event: RigCapacitySetEvent): void {
  let rigAddress = event.address.toHexString();
  let rig = getOrCreateRig(rigAddress);
  rig.capacity = event.params.capacity;
  rig.save();
}

export function handleRigUriSet(event: RigUriSetEvent): void {
  let rigAddress = event.address.toHexString();
  let rig = getOrCreateRig(rigAddress);
  rig.uri = event.params.uri;
  rig.save();
}
