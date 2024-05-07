const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");

const chainId = 31337;

async function main() {
    const [owner] = await ethers.getSigners();
    const Coiin = await ethers.getContractFactory("Coiin");
    const coiin = await Coiin.attach("0x83CACFa3d369973e40651468CA55B3f93eB7C577")

    console.log((await coiin.getAddress()))

    //let expires = await Date.now() + (1000 * 60 * 60 * 24 * 7)
    let sig = await getSignature(
        owner.address,
        ethers.parseEther("1"),
        1707189696,
        0,
        (await coiin.getAddress())
    )

    console.log(sig)
    await coiin.withdraw(ethers.parseEther("1"), 1707189696, 0, sig)
    console.log("done")


}

const getSignature = async function (sender, amount, expires, nonce, coiin) {

    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    let message = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address", "uint"],
        [sender, amount, expires, nonce, coiin, chainId]
    )
    let sig = await otherAccount.signMessage(ethers.getBytes(message));
    return sig

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
