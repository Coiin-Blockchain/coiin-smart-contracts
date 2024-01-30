const {loadFixture, time} = require("@nomicfoundation/hardhat-network-helpers");
const {expect} = require("chai");

const { ethers } = require("hardhat");

describe("Coiin", function () {
    async function deployOneYearLockFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        const Coiin = await ethers.getContractFactory("Coiin");
        const coiin = await Coiin.deploy(owner, "Coiin", "COIINAM");

        return {coiin, owner, otherAccount};
    }

    describe("Withdraw", function () {
        it("Contract Pause", async function () {
            const {coiin} = await loadFixture(deployOneYearLockFixture);

            expect(await coiin.withdrawalsPaused()).to.equal(false);
            await coiin.pauseWithdrawals(true);
            expect(await coiin.withdrawalsPaused()).to.equal(true);

            await expect(coiin.withdraw(
                1,
                Math.floor(new Date().getTime() / 1000),
                1,
                '0x00',
            )).to.be.revertedWith("Contract Paused");
        });

        it("Contract withdraw zero amount", async function () {
            const {coiin} = await loadFixture(deployOneYearLockFixture);

            await expect(coiin.withdraw(
                0,
                Math.floor(new Date().getTime() / 1000) + 10000,
                1,
                '0x00',
            )).to.be.revertedWith("Minting zero tokens.");
        });

        it("Contract withdraw dup transaction", async function () {
            const {coiin} = await loadFixture(deployOneYearLockFixture);

            await expect(coiin.withdraw(
                1,
                Math.floor(new Date().getTime() / 1000) + 10000,
                0, // Zero nonce is already marked as used
                '0x00',
            )).to.be.revertedWith("duplicate transaction found, start new request from Coiin");

        });

        it("Contract withdraw expired", async function () {
            const {coiin} = await loadFixture(deployOneYearLockFixture);

            await expect(coiin.withdraw(
                1,
                Math.floor(new Date().getTime() / 1000) - 1000,
                1,
                '0x00',
            )).to.be.revertedWith("withdraw period expired");

        });

        // it("Contract withdraw not signed by coiin", async function () {
        //     const {coiin} = await loadFixture(deployOneYearLockFixture);
        //
        //     await expect(coiin.withdraw(
        //         1,
        //         Math.floor(new Date().getTime() / 1000) + 10000,
        //         1,
        //         '0x00',
        //     )).to.be.revertedWith("request not signed by Coiin");
        // });

        it("Contract withdraw", async function () {
            const {coiin, owner} = await loadFixture(deployOneYearLockFixture);

            await expect(coiin.withdraw(
                '20000000000000000000000',
                Math.floor(new Date().getTime() / 1000) + 10000,
                1,
                '0x00',
            )).to.emit(coiin, "Transfer");

            let balance = await coiin.balanceOf(owner.getAddress())
            console.log("Balance:", balance);

            let mint = await coiin.withdrawMintHistory(1)
            console.log("Mint:", mint);

            await expect(coiin.withdraw(
                '100000000000000000000',
                Math.floor(new Date().getTime() / 1000) + 10000,
                2,
                '0x00',
            )).to.be.revertedWith("exceeded withdraw account limit");
        });

        it("Contract withdraw history", async function () {
            const {coiin, owner} = await loadFixture(deployOneYearLockFixture);

            let nonce = 1;
            const accounts = await ethers.getSigners();
            for (const account of accounts) {
                await expect(coiin.connect(account).withdraw(
                    '100000000000000000000',
                    Math.floor(new Date().getTime() / 1000) + 10000,
                    nonce,
                    '0x00',
                )).to.emit(coiin, "Transfer");

                let balance = await coiin.balanceOf(account.getAddress())
                console.log(await account.getAddress(), "Balance:", balance);

                nonce++;
            }

            await time.increase(60*60*25)
            console.log("\n\n====================================\n\n")


            for (const account of accounts) {
                await expect(coiin.connect(account).withdraw(
                    '100000000000000000000',
                    (Math.floor(new Date().getTime() / 1000) + 60*60*25) + 10000,
                    nonce,
                    '0x00',
                )).to.emit(coiin, "Transfer");

                let balance = await coiin.balanceOf(account.getAddress())
                console.log(await account.getAddress(), "Balance:", balance);

                nonce++;
            }
        });
    });
});