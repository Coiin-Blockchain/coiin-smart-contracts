const {ethers, upgrades} = require("hardhat");

async function main() {
  const Coiin = await ethers.getContractFactory("CoiinV4");

  const coiin = await upgrades.upgradeProxy(
      "0x481FE356DF88169f5F38203Dd7f3C67B7559FDa5",
      Coiin,
  );

  // await upgrades.forceImport("0x481FE356DF88169f5F38203Dd7f3C67B7559FDa5", Coiin, {});

  console.log("Deployed Coiin at: ", await coiin.getAddress());
}

main();
