const { ethers, upgrades } = require("hardhat");

async function main() {

    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    const Coiin = await ethers.getContractFactory("Coiin");
    const coiin = await upgrades.deployProxy(
        Coiin,
        [
            multiSig.address,
            owner.address,
            signer.address,
            "CoiinAM",
            "COIINAM"
        ],
        { initializer: 'initialize' }
    );
    await coiin.waitForDeployment();
    console.log("Deployed Coiin at: ", (await coiin.getAddress()))
}

main();
