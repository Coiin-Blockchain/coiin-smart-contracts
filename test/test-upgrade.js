const { ethers, upgrades } = require("hardhat");

const {loadFixture, time} = require("@nomicfoundation/hardhat-network-helpers");
const {expect, use} = require("chai");

describe("Coiin Upgrade", function () {
    async function deployCoiinFixture() {
        // Contracts are deployed using the first signer/account by default
        const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

        const Coiin = await ethers.getContractFactory("Coiin");
        // const coiin = await Coiin.deploy();

        const coiin = await upgrades.deployProxy(
            Coiin,
        [
            owner.address,
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

    describe("After Upgrade", function() {
        it("Does Upgrade", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const CoiinV2 = await ethers.getContractFactory("CoiinV2");
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3, mockUser4 ] = await ethers.getSigners();

            const newCoiin = await upgrades.upgradeProxy((await coiin.getAddress()), CoiinV2);

            // After Upgrade Anyone can mint
            await newCoiin.connect(mockUser1).withdraw(ethers.parseEther("10"))
            expect((await newCoiin.balanceOf(mockUser1.address))).to.equal(ethers.parseEther("10"))

            await newCoiin.connect(mockUser2).withdraw(ethers.parseEther("5"))
            expect((await newCoiin.balanceOf(mockUser2.address))).to.equal(ethers.parseEther("5"))

            await newCoiin.connect(mockUser3).withdraw(ethers.parseEther("3"))
            expect((await newCoiin.balanceOf(mockUser3.address))).to.equal(ethers.parseEther("3"))

            await newCoiin.connect(mockUser4).withdraw(ethers.parseEther("1"))
            expect((await newCoiin.balanceOf(mockUser4.address))).to.equal(ethers.parseEther("1"))
        })

    })


})