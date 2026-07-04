export type IconsId =
  | "weapon-trace-rifle"
  | "weapon-sword"
  | "weapon-submachine-gun"
  | "weapon-sniper-rifle"
  | "weapon-sidearm"
  | "weapon-shotgun"
  | "weapon-scout-rifle"
  | "weapon-rocket-launcher"
  | "weapon-pulse-rifle"
  | "weapon-machine-gun"
  | "weapon-linear-fusion-rifle"
  | "weapon-hand-cannon"
  | "weapon-grenade-launcher"
  | "weapon-grenade-launcher-heavy"
  | "weapon-glaive"
  | "weapon-fusion-rifle"
  | "weapon-bow"
  | "weapon-auto-rifle"
  | "power"
  | "inventory-bucket-vault"
  | "inventory-bucket-leg-armor"
  | "inventory-bucket-head-armor"
  | "inventory-bucket-energy-weapons"
  | "inventory-bucket-class-armor"
  | "inventory-bucket-chest-armor"
  | "inventory-bucket-arm-armor"
  | "damage-void"
  | "damage-strand"
  | "damage-stasis"
  | "damage-solar"
  | "damage-prismatic"
  | "damage-kinetic"
  | "damage-arc"
  | "ammo-special"
  | "ammo-primary"
  | "ammo-heavy";

export type IconsKey =
  | "WeaponTraceRifle"
  | "WeaponSword"
  | "WeaponSubmachineGun"
  | "WeaponSniperRifle"
  | "WeaponSidearm"
  | "WeaponShotgun"
  | "WeaponScoutRifle"
  | "WeaponRocketLauncher"
  | "WeaponPulseRifle"
  | "WeaponMachineGun"
  | "WeaponLinearFusionRifle"
  | "WeaponHandCannon"
  | "WeaponGrenadeLauncher"
  | "WeaponGrenadeLauncherHeavy"
  | "WeaponGlaive"
  | "WeaponFusionRifle"
  | "WeaponBow"
  | "WeaponAutoRifle"
  | "Power"
  | "InventoryBucketVault"
  | "InventoryBucketLegArmor"
  | "InventoryBucketHeadArmor"
  | "InventoryBucketEnergyWeapons"
  | "InventoryBucketClassArmor"
  | "InventoryBucketChestArmor"
  | "InventoryBucketArmArmor"
  | "DamageVoid"
  | "DamageStrand"
  | "DamageStasis"
  | "DamageSolar"
  | "DamagePrismatic"
  | "DamageKinetic"
  | "DamageArc"
  | "AmmoSpecial"
  | "AmmoPrimary"
  | "AmmoHeavy";

export enum Icons {
  WeaponTraceRifle = "weapon-trace-rifle",
  WeaponSword = "weapon-sword",
  WeaponSubmachineGun = "weapon-submachine-gun",
  WeaponSniperRifle = "weapon-sniper-rifle",
  WeaponSidearm = "weapon-sidearm",
  WeaponShotgun = "weapon-shotgun",
  WeaponScoutRifle = "weapon-scout-rifle",
  WeaponRocketLauncher = "weapon-rocket-launcher",
  WeaponPulseRifle = "weapon-pulse-rifle",
  WeaponMachineGun = "weapon-machine-gun",
  WeaponLinearFusionRifle = "weapon-linear-fusion-rifle",
  WeaponHandCannon = "weapon-hand-cannon",
  WeaponGrenadeLauncher = "weapon-grenade-launcher",
  WeaponGrenadeLauncherHeavy = "weapon-grenade-launcher-heavy",
  WeaponGlaive = "weapon-glaive",
  WeaponFusionRifle = "weapon-fusion-rifle",
  WeaponBow = "weapon-bow",
  WeaponAutoRifle = "weapon-auto-rifle",
  Power = "power",
  InventoryBucketVault = "inventory-bucket-vault",
  InventoryBucketLegArmor = "inventory-bucket-leg-armor",
  InventoryBucketHeadArmor = "inventory-bucket-head-armor",
  InventoryBucketEnergyWeapons = "inventory-bucket-energy-weapons",
  InventoryBucketClassArmor = "inventory-bucket-class-armor",
  InventoryBucketChestArmor = "inventory-bucket-chest-armor",
  InventoryBucketArmArmor = "inventory-bucket-arm-armor",
  DamageVoid = "damage-void",
  DamageStrand = "damage-strand",
  DamageStasis = "damage-stasis",
  DamageSolar = "damage-solar",
  DamagePrismatic = "damage-prismatic",
  DamageKinetic = "damage-kinetic",
  DamageArc = "damage-arc",
  AmmoSpecial = "ammo-special",
  AmmoPrimary = "ammo-primary",
  AmmoHeavy = "ammo-heavy",
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.WeaponTraceRifle]: "61697",
  [Icons.WeaponSword]: "61698",
  [Icons.WeaponSubmachineGun]: "61699",
  [Icons.WeaponSniperRifle]: "61700",
  [Icons.WeaponSidearm]: "61701",
  [Icons.WeaponShotgun]: "61702",
  [Icons.WeaponScoutRifle]: "61703",
  [Icons.WeaponRocketLauncher]: "61704",
  [Icons.WeaponPulseRifle]: "61705",
  [Icons.WeaponMachineGun]: "61706",
  [Icons.WeaponLinearFusionRifle]: "61707",
  [Icons.WeaponHandCannon]: "61708",
  [Icons.WeaponGrenadeLauncher]: "61709",
  [Icons.WeaponGrenadeLauncherHeavy]: "61710",
  [Icons.WeaponGlaive]: "61711",
  [Icons.WeaponFusionRifle]: "61712",
  [Icons.WeaponBow]: "61713",
  [Icons.WeaponAutoRifle]: "61714",
  [Icons.Power]: "61715",
  [Icons.InventoryBucketVault]: "61716",
  [Icons.InventoryBucketLegArmor]: "61717",
  [Icons.InventoryBucketHeadArmor]: "61718",
  [Icons.InventoryBucketEnergyWeapons]: "61719",
  [Icons.InventoryBucketClassArmor]: "61720",
  [Icons.InventoryBucketChestArmor]: "61721",
  [Icons.InventoryBucketArmArmor]: "61722",
  [Icons.DamageVoid]: "61723",
  [Icons.DamageStrand]: "61724",
  [Icons.DamageStasis]: "61725",
  [Icons.DamageSolar]: "61726",
  [Icons.DamagePrismatic]: "61727",
  [Icons.DamageKinetic]: "61728",
  [Icons.DamageArc]: "61729",
  [Icons.AmmoSpecial]: "61730",
  [Icons.AmmoPrimary]: "61731",
  [Icons.AmmoHeavy]: "61732",
};
