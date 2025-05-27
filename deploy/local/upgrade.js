const {ethers, upgrades} = require("hardhat");

async function main() {
  const Coiin = await ethers.getContractFactory("CoiinV6");

  // const coiin = await upgrades.upgradeProxy(
  //     "0x481FE356DF88169f5F38203Dd7f3C67B7559FDa5",
  //     Coiin,
  // );

  const coiin = await upgrades.upgradeProxy(
      "0x481FE356DF88169f5F38203Dd7f3C67B7559FDa5",
      Coiin,
  );

  // await upgrades.forceImport("0x3F7b0AEA3f938afD9B9e8201223436b469F217b9", Coiin, {});

  console.log("Deployed Coiin at: ", await coiin.getAddress());
}

main();
