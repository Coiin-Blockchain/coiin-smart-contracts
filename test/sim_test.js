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

const verifySignature = async function (sender, amount, expires, nonce, coiin, signature) {
    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    let message = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address"],
        [sender, amount, expires, nonce, coiin]
    )

    let messageHash = ethers.hashMessage(ethers.getBytes(message))
    let verification = await ethers.verifyMessage(ethers.getBytes(message), signature)
    console.log(verification)
    return verification

}

describe("sig check", function () {
    it("check sig", async function() {
        let coiin = await ethers.getContractFactory("Coiin");
        console.log("check sig")
        let verify = await verifySignature(
            "0x2403A8C8A132ACf151AAb0f26b355b370aA18e5a", 
            1,
            1707189696,
            '8470809963594808849',
            "0x1E513C77Fd27702297a102Bc6E4adE062B8481f2",
            "0xf8c8920728f0940ef86b15286e7a8a03d400dd4960167b3b5528b90c37e659063dca877b5436649915cd1c945d4edc1b5070b5a5a2b13942db0522239d080c3d00"
        )
        console.log(verify)
        console.log("Error Sigs") 
        let interface = coiin.interface
        let expired = interface.getError("Coiin__Expired")
        let Coiin__InvalidSignature = interface.getError("Coiin__InvalidSignature")
        let Coiin__MaxWithdrawAccountLimit = interface.getError("Coiin__MaxWithdrawAccountLimit")
        let Coiin__MaxWithdrawClusterLimit = interface.getError("Coiin__MaxWithdrawClusterLimit")
        let Coiin__MaxWithdrawLimit = interface.getError("Coiin__MaxWithdrawLimit")
        let Coiin__BalanceTooLow = interface.getError("Coiin__BalanceTooLow")
        let Coiin__InvalidNonce = interface.getError("Coiin__InvalidNonce")
        let Coiin__ZeroAmount = interface.getError("Coiin__ZeroAmount")
        console.log("====Errors======")
        console.log("Expired: ", expired.selector)
        console.log("InvalidSignature: ", Coiin__InvalidSignature.selector)
        console.log("MaxWithdrawAccountLimit: ", Coiin__MaxWithdrawAccountLimit.selector)
        console.log("MaxWithdrawClusterLimit: ", Coiin__MaxWithdrawClusterLimit.selector)
        console.log("MaxWithdrawLimit: ", Coiin__MaxWithdrawLimit.selector)
        console.log("BalanceTooLow: ", Coiin__BalanceTooLow.selector)
        console.log("InvalidNonce: ", Coiin__InvalidNonce.selector)
        console.log("ZeroAmount: ", Coiin__ZeroAmount.selector)



    })
})

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
        this.timeout(0)
        const { coiin } = await loadFixture(deployCoiinFixture);
        const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3, mockUser4 ] = await ethers.getSigners();
        //var cluster = []
        var mintHistory = []
        // Track the Withdraw limit 24 Hours 
        // Track the cluster limits 

        // ignore cluster limit 
        //await coiin.connect(multiSig).setWithdrawClusterLimits(ethers.parseEther('10000000000000'), (60), 10)
        //await coiin.connect(multiSig).setWithdrawMaxLimits(ethers.parseEther('200000000000000'), (60))
        let user_start = 4
        let user_range = 10
        let nonce = 0

        let totalSupply = await coiin.totalSupply()
        var balances = Array(user_range+1).fill(ethers.toBigInt(0))

        // random mint amount
        for (let i = 0; i < 10000; i++) {
            let mint_amount = ethers.parseEther((getRandomInt(3, 6666)).toString())
            let expiresIn = getRandomInt(60*60, (60*60*24))
            let now = (await time.latest())
            let expires = now + expiresIn

            let user_index = getRandomInt(user_start, user_range)
            let user = (await ethers.getSigners())[user_index]

            let time_increase = getRandomInt(1, 60*3)
            await time.increase(time_increase)
            now = await time.latest()

            let signature = await getSignature(
                user.address,
                mint_amount,
                expires,
                nonce,
                (await coiin.getAddress())
            )

            if(now > expires) {
                //console.log("Coiin__Expired")
                await expect((
                    coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                )).to.be.revertedWithCustomError(coiin, "Coiin__Expired")
            } else if (mint_amount > ethers.parseEther("20000")) {
                //console.log("Coiin__MaxWithdrawAccountLimit")
                await expect((
                    coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                    )).to.be.revertedWithCustomError(coiin, "Coiin__MaxWithdrawAccountLimit")
            } else {
                let withdrawHistory = {
                    user: user.address,
                    amount: mint_amount,
                    timestamp: now
                }
                // withdraw history
                // check withdraw history 
                let withdrawTotal = ethers.toBigInt(0)
                let clusterTotal = ethers.toBigInt(0)
                let accountTotal = ethers.toBigInt(0)
                let temp = mintHistory
                for (let i = 0; i < mintHistory.length; i++) {
                    if (mintHistory[i].timestamp <= (now - (60*60*24))) {
                        mintHistory.shift()
                        i = i -1
                    } else {
                        withdrawTotal += mintHistory[i].amount
                        if (i >= mintHistory.length - 10 ) {
                            //                        in cluster 
                            if (mintHistory[i] != undefined) {
                                if (mintHistory[i].timestamp >= (now - (60*60*12))) {
                                    clusterTotal += mintHistory[i].amount
                                }   
                            }
                        }
                        if (mintHistory[i].user == user.address) {
                            accountTotal += mintHistory[i].amount
                        }
                    }

                }

                console.log("mint amount: ", mint_amount / ethers.parseEther("1"), "total mint: ", withdrawTotal/ ethers.parseEther("1"), "cluster total: ", clusterTotal/ ethers.parseEther("1"), " account total: ", accountTotal/ ethers.parseEther("1"))
                if (ethers.toBigInt(withdrawTotal) + mint_amount > ethers.parseEther("100000")) {
                    console.log("=======Coiin__MaxWithdrawLimit=======")
                    await expect((
                        coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                        )).to.be.revertedWithCustomError(coiin, "Coiin__MaxWithdrawLimit")

                    await time.increase(60*60*3)
                } else if (ethers.toBigInt(accountTotal) + mint_amount > ethers.parseEther("20000")) {
                    console.log("Coiin__MaxWithdrawAccountLimit")
                    await expect((
                        coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                    )).to.be.revertedWithCustomError(coiin, "Coiin__MaxWithdrawAccountLimit")

                    await time.increase(60*60*3)
                } else if (ethers.toBigInt(clusterTotal) + mint_amount > ethers.parseEther("33333")) {
                    console.log("Coiin__MaxWithdrawClusterLimit")
                    await expect((
                        coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                        )).to.be.revertedWithCustomError(coiin, "Coiin__MaxWithdrawClusterLimit")

                    await time.increase(60*60*3)
                } else {
                    mintHistory.push(withdrawHistory)
                    //console.log("success")
                    await coiin.connect(user).withdraw(mint_amount, expires, nonce, signature)
                    totalSupply += mint_amount
                    balances[user_index] += mint_amount
                    expect((await coiin.totalSupply())).to.equal(totalSupply)
                    expect((await coiin.balanceOf(user.address))).to.equal(balances[user_index])
                }

            }
            nonce++;
        }
    })
})