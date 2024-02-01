const {loadFixture, time} = require("@nomicfoundation/hardhat-network-helpers");
const {expect, use} = require("chai");

const hre = require("hardhat");
const ethers = hre.ethers;

const getSignature = async function (sender, amount, expires, nonce, coiin) {

    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    let message = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address"],
        [sender, amount, expires, nonce, coiin]
    )
    let sig = await signer.signMessage(ethers.getBytes(message));
    return sig

}
describe("Coiin", function () {
    async function deployCoiinFixture() {
        // Contracts are deployed using the first signer/account by default
        const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

        const Coiin = await ethers.getContractFactory("Coiin");
        const coiin = await Coiin.deploy(owner, owner, multiSig, signer, "Coiin", "COIINAM");

        return {coiin, owner, otherAccount};
    }

    describe("Test Withdraw", function () {
        it("Checks Contract Withdraw with signature verification", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day + 60*60*24

            // Hash the info
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress())]
            )            
            // sign the hash as bytes
            let sig = await signer.signMessage(ethers.getBytes(message));
            await coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig);
        })
        it("Checks Withdraw with invalid signature", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day + 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [mockUser1.address, ethers.parseEther('100'), expires, 1, (await coiin.getAddress())]
            )            
            //sign with the wrong key
            let sig = await mockUser2.signMessage(ethers.getBytes(message));
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.revertedWithCustomError(coiin, "Coiin__InvalidSignature");
        })
        it("checks withdraw fails with used nonce", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day + 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress())]
            )            
            let sig = await signer.signMessage(ethers.getBytes(message));
            await coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig);
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.revertedWithCustomError(coiin, "Coiin__InvalidNonce");
        })
        it("checks that withdraw fails with expired signature", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day - 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress())]
            )            
            let sig = await signer.signMessage(ethers.getBytes(message));
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.revertedWithCustomError(coiin, "Coiin__Expired");
        })
        it("checks that withdraw fails with zero amount", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day + 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [mockUser1.address, 0, expires, 0, (await coiin.getAddress())]
            )            
            let sig = await signer.signMessage(ethers.getBytes(message));
            await expect(
                coiin.connect(mockUser1).withdraw(0, expires, 0, sig)
            ).to.be.revertedWithCustomError(coiin, "Coiin__ZeroAmount");
        })
        it("checks that withdraw fails with paused contract", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day + 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress())]
            )            
            let sig = await signer.signMessage(ethers.getBytes(message));
            await coiin.pauseWithdrawals(true);
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.revertedWithCustomError(coiin, "Coiin__ContractPaused");
        })
    })

    describe("Withdraw", function () {
        it("Contract withdraw", async function () {
            const {coiin} = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

            let expires = Math.floor(new Date().getTime() / 1000) + 10000
            let sig = await getSignature(
                mockUser1.address, ethers.parseEther('100'), expires, 10, (await coiin.getAddress())
            )
            await expect(coiin.connect(mockUser1).withdraw(
                ethers.parseEther('100'),
                expires,
                10,
                sig
            )).to.emit(coiin, "Transfer");

            let balance = await coiin.balanceOf(owner.getAddress())
            console.log("Balance:", balance);

            let mint = await coiin.withdrawMintHistory(1)
            console.log("Mint:", mint);

            sig = await getSignature(
                mockUser1.address, ethers.parseEther('200000'), expires, 11, (await coiin.getAddress())
            )
            await expect(coiin.connect(mockUser1).withdraw(
                ethers.parseEther('200000'),
                expires,
                11,
                sig
            )).to.be.revertedWithCustomError(coiin, "Coiin__MaxWithdrawAccountLimit");
        });

        it("Contract withdraw history", async function () {
            const {coiin, owner} = await loadFixture(deployCoiinFixture);

            let nonce = 1;
            const accounts = await ethers.getSigners();
            for (const account of accounts) {
                let one_day = (await time.latest())
                let expires = one_day + 60*60*24
                let sig = await getSignature(
                    account.address, ethers.parseEther('100'), expires, nonce, (await coiin.getAddress())
                )
                await expect(coiin.connect(account).withdraw(
                    ethers.parseEther('100'),
                    expires,
                    nonce,
                    sig,
                )).to.emit(coiin, "Transfer");

                let balance = await coiin.balanceOf(account.getAddress())
                console.log(await account.getAddress(), "Balance:", balance);

                nonce++;
            }

            await time.increase(60*60*25)
            console.log("\n\n====================================\n\n")


            for (const account of accounts) {
                let one_day = (await time.latest())
                let expires = one_day + 60*60*24
                let sig = await getSignature(
                    account.address, ethers.parseEther('100'), expires, nonce, (await coiin.getAddress())
                )
                await expect(coiin.connect(account).withdraw(
                    ethers.parseEther('100'),
                    expires,
                    nonce,
                    sig,
                )).to.emit(coiin, "Transfer");

                let balance = await coiin.balanceOf(account.getAddress())
                console.log(await account.getAddress(), "Balance:", balance);

                nonce++;
            }
        });
    });
});