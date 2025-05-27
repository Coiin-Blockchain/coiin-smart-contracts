const { ethers, upgrades } = require("hardhat");

async function main() {

    const [ owner ] = await ethers.getSigners();
    const Coiin = await ethers.getContractFactory("CoiinV4");
    const coiin = await upgrades.deployProxy(
        Coiin,
        [
            "0x41eDb5445A610dcB86d171C8736fC21ca4870930",
            "0x41eDb5445A610dcB86d171C8736fC21ca4870930",
            "0x41eDb5445A610dcB86d171C8736fC21ca4870930",
            "Coffee",
            "COFF"
        ],
        { initializer: 'initialize' }
    );
    await coiin.waitForDeployment();

    const UPGRADER_ROLE = await coiin.UPGRADER_ROLE();
    await coiin.connect(owner).grantRole(UPGRADER_ROLE, "0x41eDb5445A610dcB86d171C8736fC21ca4870930");

    console.log("Deployed Coiin at: ", (await coiin.getAddress()))
}

main();
