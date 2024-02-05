const {loadFixture, time} = require("@nomicfoundation/hardhat-network-helpers");
const {expect, use} = require("chai");

const hre = require("hardhat");
const {ethers, upgrades } = require("hardhat");
const { extendConfig } = require("hardhat/config");

const getSignature = async function (sender, amount, expires, nonce, coiin) {

    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    let message = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address"],
        [sender, amount, expires, nonce, coiin]
    )
    let sig = await signer.signMessage(ethers.getBytes(message));
    return sig

}

// get a random number in range
const getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe("Simulation Testing", function () {
    async function deployCoiinFixture() {
        // Contracts are deployed using the first signer/account by default
        const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

        const Coiin = await ethers.getContractFactory("Coiin");
                // const coiin = await Coiin.deploy();
        
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
        
        return {coiin, owner, otherAccount};
    }

    it("Tests", async function() {
        const { coiin } = await loadFixture(deployCoiinFixture);
        const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3, mockUser4 ] = await ethers.getSigners();

        // Track the Withdraw limit 24 Hours 
        // Track the cluster limits 

        // ignore cluster limit 
        await coiin.connect(multiSig).setWithdrawClusterLimits(ethers.parseEther('10000000000000'), (60), 10)
        await coiin.connect(multiSig).setWithdrawMaxLimits(ethers.parseEther('200000000000000'), (60))
        let user_start = 4
        let user_range = 19
        let nonce = 0
        let cluster = []

        // random mint amount
        for (let i = 0; i < 250; i++) {
            let mint_amount = ethers.parseEther((getRandomInt(1, 100000)).toString())
            let expiresIn = getRandomInt(60, (60*60*24))
            let expires = (await time.latest()) + expiresIn

            let user_index = getRandomInt(user_start, user_range)
            let user = (await ethers.getSigners())[user_index]

            let time_increase = getRandomInt(1, 60*60*24)
            await time.increase(time_increase)

            let signature = await getSignature(
                user.address,
                mint_amount,
                expires,
                nonce,
                (await coiin.getAddress())
            )
            // mint amount to ether 
            // mint_amount formatted as ether 

            // console.log("time increase", time_increase)
            // console.log("expiresIn", expiresIn)
            // console.log(mint_amount / ethers.parseEther("1"))

            // console.log("expires", expires)
            // console.log("latest: ", (await time.latest()))
            if(time_increase > expiresIn) {
                // console.log("hit exired")
                console.log("Coiin__Expired")
                await expect((
                    coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                )).to.be.revertedWithCustomError(coiin, "Coiin__Expired")
            } else if (mint_amount > ethers.parseEther("20000")) {
                // withdraw account limit 
                // console.log("hit withdraw")
                console.log("Coiin__MaxWithdrawAccountLimit")
                await expect((
                    coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                    )).to.be.revertedWithCustomError(coiin, "Coiin__MaxWithdrawAccountLimit")
            } else {
                console.log("success")
                await coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
            }

            // console.log(ethers.parseUnits(mint_amount.toString(), "wei").toString())

            nonce++;
            // console.log(nonce)
            
            // if (mint_amount > )
        }
    })
})