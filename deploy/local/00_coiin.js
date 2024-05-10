const { ethers, upgrades } = require("hardhat");

async function main() {

    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    const Coiin = await ethers.getContractFactory("Coiin");
    const coiin = await upgrades.deployProxy(
        Coiin,
        [
            "0x41eDb5445A610dcB86d171C8736fC21ca4870930",
            "0x41eDb5445A610dcB86d171C8736fC21ca4870930",
            "0x41eDb5445A610dcB86d171C8736fC21ca4870930",
            "Coiin",
            "COIIN"
        ],
        { initializer: 'initialize' }
    );
    await coiin.waitForDeployment();

    const UPGRADER_ROLE = await coiin.UPGRADER_ROLE();
    await coiin.connect(owner).grantRole(UPGRADER_ROLE, "0x41eDb5445A610dcB86d171C8736fC21ca4870930");

    console.log("Deployed Coiin at: ", (await coiin.getAddress()))
}

main();
