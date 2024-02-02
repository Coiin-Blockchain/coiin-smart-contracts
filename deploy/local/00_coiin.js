const { ethers, upgrades } = require("hardhat");

async function main() {
    const Coiin = await ethers.getContractFactory("Coiin");
    const coiin = await upgrades.deployProxy(
        Coiin,
        ["CoiinAM", "COIINAM"],
        { initializer: 'initialize' }
    );
    await coiin.deployed();
}

main();