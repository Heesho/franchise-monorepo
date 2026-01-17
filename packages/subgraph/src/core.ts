import { BigInt } from "@graphprotocol/graph-ts";
import { Core__Launched as CoreLaunchedEvent } from "../generated/Core/Core";
import { Rig as RigTemplate } from "../generated/templates";
import { Launchpad, Rig, Account } from "../generated/schema";
import { ZERO_BD, ZERO_BI, ONE_BI, LAUNCHPAD_ID } from "./constants";
import { convertTokenToDecimal } from "./helpers";

export function handleCoreLaunched(event: CoreLaunchedEvent): void {
  // Load or create Launchpad entity
  let launchpad = Launchpad.load(LAUNCHPAD_ID);
  if (launchpad == null) {
    launchpad = new Launchpad(LAUNCHPAD_ID);
    launchpad.totalRigs = ZERO_BI;
    launchpad.totalRevenue = ZERO_BD;
    launchpad.totalMinted = ZERO_BD;
    launchpad.protocolRevenue = ZERO_BD;
  }
  launchpad.totalRigs = launchpad.totalRigs.plus(ONE_BI);
  launchpad.save();

  // Load or create launcher Account
  let launcher = Account.load(event.params.launcher.toHexString());
  if (launcher == null) {
    launcher = new Account(event.params.launcher.toHexString());
    launcher.save();
  }

  // Create new Rig entity
  let rig = new Rig(event.params.rig.toHexString());
  rig.launchpad = LAUNCHPAD_ID;
  rig.launcher = event.params.launcher.toHexString();
  rig.unit = event.params.unit;
  rig.quoteToken = event.params.quoteToken;
  rig.auction = event.params.auction;
  rig.lpToken = event.params.lpToken;
  rig.tokenName = event.params.tokenName;
  rig.tokenSymbol = event.params.tokenSymbol;
  rig.uri = event.params.uri;

  // Launch parameters
  rig.initialUps = event.params.initialUps;
  rig.tailUps = event.params.tailUps;
  rig.halvingAmount = event.params.halvingAmount;
  rig.rigEpochPeriod = event.params.rigEpochPeriod;
  rig.rigPriceMultiplier = convertTokenToDecimal(event.params.rigPriceMultiplier, BigInt.fromI32(18));
  rig.rigMinInitPrice = convertTokenToDecimal(event.params.rigMinInitPrice, BigInt.fromI32(18));

  // Runtime state
  rig.capacity = ONE_BI;
  rig.revenue = ZERO_BD;
  rig.teamRevenue = ZERO_BD;
  rig.minted = ZERO_BD;
  rig.lastMined = ZERO_BI;
  rig.createdAt = event.block.timestamp;
  rig.createdAtBlock = event.block.number;
  rig.save();

  // Start indexing events from the new Rig contract
  RigTemplate.create(event.params.rig);
}
