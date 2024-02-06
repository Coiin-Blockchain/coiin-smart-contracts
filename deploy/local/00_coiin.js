const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    const Coiin = await ethers.getContractFactory("Coiin");
    const coiin = await upgrades.deployProxy(
        Coiin,
        [
            deployer.address,
            "0x4B7DC4697d860efFF0F1CF073D466b9e68c7cb47",
            deployer.address,
            "Coiin",
            "COIIN"
        ],
        { initializer: 'initialize' }
    );
    await coiin.waitForDeployment();

    console.log("Contract Address:", coiin.target);
}

main();