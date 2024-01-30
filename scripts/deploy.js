async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    const Token = await ethers.getContractFactory("Coiin");
    const token = await Token.deploy(deployer.address, "CoiinAM", "COIINAM");

    console.log("Contract Address:", token.target);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
