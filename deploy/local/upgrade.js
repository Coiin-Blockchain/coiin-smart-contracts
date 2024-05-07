const { ethers, upgrades } = require("hardhat");

async function main() {
  const [
    owner,
    otherAccount,
    signer,
    multiSig,
    mockUser1,
    mockUser2,
    mockUser3,
  ] = await ethers.getSigners();
  const Coiin = await ethers.getContractFactory("Coiin");
  const coiin = await upgrades.upgradeProxy(
    "0x83CACFa3d369973e40651468CA55B3f93eB7C577",
    Coiin
  );
  // const coiin = await upgrades.deployProxy(
  //     Coiin,
  //     [
  //         owner.address,
  //         owner.address,
  //         owner.address,
  //         "CoiinMock",
  //         "COIIMOCK"
  //     ],
  //     { initializer: 'initialize' }
  // );
  //await coiin.waitForDeployment();
  console.log("Deployed Coiin at: ", await coiin.getAddress());

  // hit test revert
  // await coiin.throw_revert()
}

main();
