const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect, use } = require("chai");

const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");
const { extendConfig } = require("hardhat/config");

const chainId = 31337;

const getSignature = async function (sender, amount, expires, nonce, coiin) {
    const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
    let message = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "address", "uint"],
        [sender, amount, expires, nonce, coiin, chainId]
    )
    let sig = await signer.signMessage(ethers.getBytes(message));
    return sig

}
describe("Coiin", function () {
  async function deployCoiinFixture() {
    // Contracts are deployed using the first signer/account by default
    const [
      owner,
      otherAccount,
      signer,
      multiSig,
      mockUser1,
      mockUser2,
      mockUser3,
    ] = await ethers.getSigners();

    const Coiin = await ethers.getContractFactory("Coiin");
    // const coiin = await Coiin.deploy();

    const coiin = await upgrades.deployProxy(
      Coiin,
      [multiSig.address, owner.address, signer.address, "CoiinAM", "COIINAM"],
      { initializer: "initialize" }
    );
    await coiin.waitForDeployment();

        return {coiin, owner, otherAccount};
    }

    describe("Test Transfer From Lock", function() {
        it("Check Set Transfer Unlock Date", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

            let newUnlockDate = await time.latest() - 100;
            await expect(
                coiin.connect(multiSig).setTransferFromUnlockDate(newUnlockDate)
            ).to.be.rejectedWith("New unlock date must be in the future");

            newUnlockDate = await time.latest() + 2000;
            await expect(
                coiin.connect(multiSig).setTransferFromUnlockDate(newUnlockDate)
            ).to.be.fulfilled;

            await expect(await coiin.connect(multiSig).transferFromUnlockDate()).to.be.equal(newUnlockDate);
        })

        it("Check Set Transfer From Whitelist", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

            let newUnlockDate = await time.latest() + 1000;
            await coiin.connect(multiSig).setTransferFromUnlockDate(newUnlockDate)

            await expect(
                await coiin.connect(multiSig).transferFromWhiteList(otherAccount)
            ).to.be.equal(false);

            await expect(
                coiin.connect(multiSig).setTransferFromWhiteList(otherAccount)
            ).to.be.fulfilled;

            await expect(
                await coiin.connect(multiSig).transferFromWhiteList(otherAccount)
            ).to.be.equal(true);

            await expect(
                coiin.connect(multiSig).removeTransferFromWhiteList(otherAccount)
            ).to.be.fulfilled;

            await expect(
                await coiin.connect(multiSig).transferFromWhiteList(otherAccount)
            ).to.be.equal(false);

            await time.increase(newUnlockDate + 1000);

            await expect(
                coiin.connect(multiSig).setTransferFromWhiteList(mockUser1)
            ).to.be.rejectedWith("Can no longer add whitelist address");

            await expect(
                coiin.connect(multiSig).removeTransferFromWhiteList(mockUser1)
            ).to.be.rejectedWith("Can no longer remove whitelist address");
        })

        it("Check Transfer From", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();

            let newUnlockDate = await time.latest() + 1000;
            await coiin.connect(multiSig).setTransferFromUnlockDate(newUnlockDate)
            await coiin.connect(owner).approve(multiSig, 1000);
            await coiin.connect(owner).approve(mockUser1, 1000);
            await coiin.connect(owner).approve(mockUser2, 1000);

            await expect(
                coiin.connect(mockUser1).transferFrom(owner, mockUser3, 10)
            ).to.be.rejectedWith("Not authorized at this time.");

            await coiin.connect(multiSig).setTransferFromWhiteList(mockUser1);

            await expect(
                coiin.connect(multiSig).transferFrom(owner, mockUser3, 10)
            ).to.be.fulfilled;

            await expect(
                coiin.connect(mockUser1).transferFrom(owner, mockUser3, 10)
            ).to.be.fulfilled;

            await expect(
                coiin.connect(mockUser2).transferFrom(owner, mockUser3, 10)
            ).to.be.rejectedWith("Not authorized at this time.");

            await time.increase(newUnlockDate + 1001);

            await expect(
                coiin.connect(mockUser2).transferFrom(owner, mockUser3, 10)
            ).to.be.fulfilled;
        })
    })

    describe("Test Burn", function() {
        it("Checks can Burn tokens", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let bal = await coiin.balanceOf(owner.address);
            await coiin.connect(owner).deposit(ethers.parseEther('100'));
            let delta = bal - (( await coiin.balanceOf(owner.address) ));
            expect(delta).to.be.equal(ethers.parseEther('100'));
        })
        it("Checks deposit(burn) revert with balance low", async function() {   
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            // await expect(
            //     coiin.connect(mockUser1).deposit(ethers.parseEther('100'))
            // ).to.be.revertedWithCustomError(coiin, "Coiin__BalanceTooLow");
            await expect(
                coiin.connect(mockUser1).deposit(ethers.parseEther('100'))
            ).to.be.rejectedWith("Coiin: Balance too low");
        })
    })

  describe("Test Withdraw Signatures", function () {
    it("Checks Contract Withdraw with signature verification", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();
      let one_day = await time.latest();
      let expires = one_day + 60 * 60 * 24;

            // Hash the info
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address","uint256"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress()),chainId]
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
            ).to.be.rejectedWith("Coiin: Invalid Signature");
        })
        it("checks withdraw fails with used nonce", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day + 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address","uint256"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress()),chainId]
            )            
            let sig = await signer.signMessage(ethers.getBytes(message));
            await coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig);
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.rejectedWith("Coiin: Invalid nonce");
        })
        it("checks that withdraw fails with expired signature", async function() {
            const { coiin } = await loadFixture(deployCoiinFixture);
            const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
            let one_day = (await time.latest())
            let expires = one_day - 60*60*24
            let message = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256", "uint256", "address","uint256"],
                [mockUser1.address, ethers.parseEther('100'), expires, 0, (await coiin.getAddress()),chainId]
            )            
            let sig = await signer.signMessage(ethers.getBytes(message));
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.rejectedWith("Coiin: Expired");
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
            ).to.be.rejectedWith("Coiin: Zero amount");
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
            const PAUSER_ROLE = await coiin.PAUSER_ROLE();
            await coiin.connect(multiSig).grantRole(PAUSER_ROLE, multiSig);
            await coiin.connect(multiSig).pauseWithdrawals(true);
            await expect(
                coiin.connect(mockUser1).withdraw(ethers.parseEther('100'), expires, 0, sig)
            ).to.be.rejectedWith("Coiin: Contract Paused");
        })
        describe("Test Withdraw Limits", function () {
            // Account Limit per Period = 20,000
            // Account Limit Period = 24 hours
            it("checks that withdraw amount over account limit reverts", async function() {
                const { coiin } = await loadFixture(deployCoiinFixture);
                const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
                let one_day = (await time.latest())
                let expires = one_day + 60*60*24
                let amount = ethers.parseEther('20001')
                let sig = getSignature(
                    mockUser1.address, amount, expires, 0, (await coiin.getAddress())
                )
                await expect(
                    coiin.connect(mockUser1).withdraw(amount, expires, 0, sig)
                ).to.be.rejectedWith("Coiin: Max Withdraw Account Limit");
            })
            it("Checks Account Withdraw Limit per Period", async function() {
                const { coiin } = await loadFixture(deployCoiinFixture);
                const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3 ] = await ethers.getSigners();
                let one_day = (await time.latest())
                let expires = one_day + 60*60*24
                let amount = ethers.parseEther('20000')
                let sig = getSignature(
                    mockUser1.address, amount, expires, 0, (await coiin.getAddress())
                )
                let sig2 = getSignature(
                    mockUser1.address, amount, expires, 1, (await coiin.getAddress())
                )
                await coiin.connect(mockUser1).withdraw(amount, expires, 0, sig)
                await expect(
                    coiin.connect(mockUser1).withdraw(amount, expires, 1, sig2)
                ).to.be.rejectedWith("Coiin: Max Withdraw Account Limit");
            })
            // period limit = 100,000
            // period = 24 hours
            it("checks that withdraw amount over daily limit reverts", async function() {
                const { coiin } = await loadFixture(deployCoiinFixture);
                const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3, mockUser4, mockUser5, mockUser6] = await ethers.getSigners();
                // ignore cluster limit
                await coiin.connect(multiSig).setWithdrawClusterLimits(ethers.parseEther('1000000000000'), (60*60*12), 10)
                let one_day = (await time.latest())
                let expires = one_day + 60*60*24
                let amount = ethers.parseEther('20000')
                let sig = getSignature(
                    mockUser1.address, amount, expires, 0, (await coiin.getAddress())
                )
                let sig2 = getSignature(
                    mockUser2.address, amount, expires, 1, (await coiin.getAddress())
                )
                let sig3 = getSignature(
                    mockUser3.address, amount, expires, 2, (await coiin.getAddress())
                )
                let sig4 = getSignature(
                    mockUser4.address, amount, expires, 3, (await coiin.getAddress())
                )
                let sig5 = getSignature(
                    mockUser5.address, amount, expires, 4, (await coiin.getAddress())
                )
                let sig6 = getSignature(
                    mockUser6.address, amount, expires, 5, (await coiin.getAddress())
                )

                coiin.connect(mockUser1).withdraw(amount, expires, 0, sig)
                coiin.connect(mockUser2).withdraw(amount, expires, 1, sig2)
                coiin.connect(mockUser3).withdraw(amount, expires, 2, sig3)
                coiin.connect(mockUser4).withdraw(amount, expires, 3, sig4)
                coiin.connect(mockUser5).withdraw(amount, expires, 4, sig5)
                
                await expect(
                    coiin.connect(mockUser6).withdraw(amount, expires, 5, sig6)
                ).to.be.rejectedWith(coiin, "Coiin: Max Withdraw Limit");
            })
            // cluster limit = 33,000
            // period = 12 hours
            // cluster limit = 10
            it("checks that withdraw amount over cluster limit reverts", async function() {
                const { coiin } = await loadFixture(deployCoiinFixture);
                const [ owner, otherAccount, signer, multiSig, mockUser1, mockUser2, mockUser3, mockUser4, mockUser5, mockUser6] = await ethers.getSigners();
                let one_day = (await time.latest())
                let expires = one_day + 60*60*24
                let amount = ethers.parseEther('3333.3')
                let nonce = 0 
                let user = 4 // mock user index start

        for (let i = 0; i < 9; i++) {
          let userWallet = (await ethers.getSigners())[user + i];
          let sig = getSignature(
            userWallet.address,
            amount,
            expires,
            i,
            await coiin.getAddress()
          );
          await coiin.connect(userWallet).withdraw(amount, expires, i, sig);
        }

        let userWallet = (await ethers.getSigners())[user + 9];
        let sig = getSignature(
          userWallet.address,
          ethers.parseEther("3334"),
          expires,
          9,
          await coiin.getAddress()
        );
        await expect(
          coiin
            .connect(userWallet)
            .withdraw(ethers.parseEther("3334"), expires, 9, sig)
        ).to.be.rejectedWith(coiin, "Coiin: Max Withdraw Cluster Limit");
      });
      it("Tests 24 hour window", async function () {
        const { coiin } = await loadFixture(deployCoiinFixture);
        const [
          owner,
          otherAccount,
          signer,
          multiSig,
          mockUser1,
          mockUser2,
          mockUser3,
          mockUser4,
          mockUser5,
          mockUser6,
        ] = await ethers.getSigners();
        // ignore cluster limit
        await coiin
          .connect(multiSig)
          .setWithdrawClusterLimits(
            ethers.parseEther("1000000000000"),
            60 * 60 * 12,
            10
          );
        // ignore account limit
        await coiin
          .connect(multiSig)
          .setWithdrawAccountLimits(
            ethers.parseEther("1000000000000"),
            60 * 60 * 24
          );
        let one_day = await time.latest();
        let expires = one_day + 60 * 60 * 48;
        let amount = ethers.parseEther("10000");
        let user = 4;
        // 9 users withdraw 20,000 * 10 = 100,000
        for (let i = 0; i < 10; i++) {
          if (i == 1) {
            await time.increase(60 * 60 * 12);
          }
          let userWallet = (await ethers.getSigners())[user + i];
          let sig = getSignature(
            userWallet.address,
            amount,
            expires,
            i,
            await coiin.getAddress()
          );
          await coiin.connect(userWallet).withdraw(amount, expires, i, sig);
        }

        await time.increase(60 * 60 * 13);
        // next withdraw should drop 1 * 10,000 out of the window
        let userWallet = 10 + 4;
        let sig = getSignature(
          (await ethers.getSigners())[userWallet].address,
          amount,
          expires,
          10,
          await coiin.getAddress()
        );
        await coiin
          .connect((await ethers.getSigners())[userWallet])
          .withdraw(amount, expires, 10, sig);
        // limit should be hit
        userWallet = 10 + 5;
        sig = getSignature(
          (await ethers.getSigners())[userWallet].address,
          amount,
          expires,
          11,
          await coiin.getAddress()
        );
        await expect(
          coiin
            .connect((await ethers.getSigners())[userWallet])
            .withdraw(amount, expires, 11, sig)
        ).to.be.rejectedWith("Coiin: Max Withdraw Limit");

        // after another 13 hours the window should cleared of 9 with 10,000 remaining
        await time.increase(60 * 60 * 13);
        userWallet = 10 + 6;
        sig = getSignature(
          (await ethers.getSigners())[userWallet].address,
          amount,
          expires,
          12,
          await coiin.getAddress()
        );
        await coiin
          .connect((await ethers.getSigners())[userWallet])
          .withdraw(amount, expires, 12, sig);
        // current window is 20,000
        // 80,001 should revert
        userWallet = 10 + 7;
        sig = getSignature(
          (await ethers.getSigners())[userWallet].address,
          ethers.parseEther("80001"),
          expires,
          13,
          await coiin.getAddress()
        );
        await expect(
          coiin
            .connect((await ethers.getSigners())[userWallet])
            .withdraw(ethers.parseEther("80001"), expires, 13, sig)
        ).to.be.rejectedWith("Coiin: Max Withdraw Limit");
        userWallet = 10 + 7;
        sig = getSignature(
          (await ethers.getSigners())[userWallet].address,
          ethers.parseEther("80000"),
          expires,
          13,
          await coiin.getAddress()
        );
        await coiin
          .connect((await ethers.getSigners())[userWallet])
          .withdraw(ethers.parseEther("80000"), expires, 13, sig);
      });
      it("tests Rescue Tokens from contract", async function () {
        const { coiin } = await loadFixture(deployCoiinFixture);
        const [
          owner,
          otherAccount,
          signer,
          multiSig,
          mockUser1,
          mockUser2,
          mockUser3,
          mockUser4,
          mockUser5,
          mockUser6,
        ] = await ethers.getSigners();
        let address = await coiin.getAddress();

        await coiin.connect(owner).transfer(address, ethers.parseEther("1000"));

        await coiin.connect(multiSig).rescue(address, ethers.parseEther("500"));
        expect(await coiin.balanceOf(address)).to.be.equal(
          ethers.parseEther("500")
        );
        await coiin.connect(multiSig).rescue(address, ethers.parseEther("500"));
        expect(await coiin.balanceOf(address)).to.be.equal(
          ethers.parseEther("0")
        );
      });
    });
  });

  describe("Withdraw", function () {
    it("Contract withdraw", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      let expires = Math.floor(new Date().getTime() / 1000) + 10000;
      let sig = await getSignature(
        mockUser1.address,
        ethers.parseEther("100"),
        expires,
        10,
        await coiin.getAddress()
      );
      await expect(
        coiin
          .connect(mockUser1)
          .withdraw(ethers.parseEther("100"), expires, 10, sig)
      ).to.emit(coiin, "Transfer");

      let balance = await coiin.balanceOf(owner.getAddress());
      console.log("Balance:", balance);

      let mint = await coiin.withdrawMintHistory(1);
      console.log("Mint:", mint);

      sig = await getSignature(
        mockUser1.address,
        ethers.parseEther("200000"),
        expires,
        11,
        await coiin.getAddress()
      );
      await expect(
        coiin
          .connect(mockUser1)
          .withdraw(ethers.parseEther("200000"), expires, 11, sig)
      ).to.be.rejectedWith("Coiin: Max Withdraw Account Limit");
    });

    it("Contract withdraw history", async function () {
      const { coiin, owner } = await loadFixture(deployCoiinFixture);

      let nonce = 1;
      const accounts = await ethers.getSigners();
      for (const account of accounts) {
        let one_day = await time.latest();
        let expires = one_day + 60 * 60 * 24;
        let sig = await getSignature(
          account.address,
          ethers.parseEther("100"),
          expires,
          nonce,
          await coiin.getAddress()
        );
        await expect(
          coiin
            .connect(account)
            .withdraw(ethers.parseEther("100"), expires, nonce, sig)
        ).to.emit(coiin, "Transfer");

        let balance = await coiin.balanceOf(account.getAddress());
        console.log(await account.getAddress(), "Balance:", balance);

        nonce++;
      }

      await time.increase(60 * 60 * 25);
      console.log("\n\n====================================\n\n");

      for (const account of accounts) {
        let one_day = await time.latest();
        let expires = one_day + 60 * 60 * 24;
        let sig = await getSignature(
          account.address,
          ethers.parseEther("100"),
          expires,
          nonce,
          await coiin.getAddress()
        );
        await expect(
          coiin
            .connect(account)
            .withdraw(ethers.parseEther("100"), expires, nonce, sig)
        ).to.emit(coiin, "Transfer");

        let balance = await coiin.balanceOf(account.getAddress());
        console.log(await account.getAddress(), "Balance:", balance);

        nonce++;
      }
    });
  });
  describe("Test Access Controls", function () {
    it("Should only Allow the account having Admin_Role  to grant PAUSER_ROLE to the address", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      const PAUSER_ROLE = await coiin.PAUSER_ROLE();
      await coiin.connect(multiSig).grantRole(PAUSER_ROLE, otherAccount);
      const hasPauserRole = await coiin.hasRole(PAUSER_ROLE, otherAccount);

      expect(hasPauserRole).to.be.true;
    });
    it("Should only Allow the account having Admin_Role  to grant UPGRADER_ROLE  to the address", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      const UPGRADER_ROLE = await coiin.PAUSER_ROLE();
      await coiin.connect(multiSig).grantRole(UPGRADER_ROLE, otherAccount);
      const hasUpgraderRole = await coiin.hasRole(UPGRADER_ROLE, otherAccount);

      expect(hasUpgraderRole).to.be.true;
    });
    it("Should only not Allow anyone except Admin_Role  to grant PAUSER_ROLE to the address", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      const PAUSER_ROLE = await coiin.PAUSER_ROLE();
      const DEFAULT_ADMIN_ROLE = await coiin.DEFAULT_ADMIN_ROLE();
      await expect(
        coiin.connect(signer).grantRole(PAUSER_ROLE, otherAccount)
      ).to.be.rejectedWith(
        `AccessControlUnauthorizedAccount("${signer.address}", "${DEFAULT_ADMIN_ROLE}")`
      );
      const hasPauserRole = await coiin.hasRole(PAUSER_ROLE, otherAccount);

      expect(hasPauserRole).to.be.false;
    });
    it("Should only not Allow anyone except Admin_Role  to grant UPGRADER_ROLE to the address", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      const UPGRADER_ROLE = await coiin.UPGRADER_ROLE();
      const DEFAULT_ADMIN_ROLE = await coiin.DEFAULT_ADMIN_ROLE();
      await expect(
        coiin.connect(signer).grantRole(UPGRADER_ROLE, otherAccount)
      ).to.be.rejectedWith(
        `AccessControlUnauthorizedAccount("${signer.address}", "${DEFAULT_ADMIN_ROLE}")`
      );
      const hasUpgraderRole = await coiin.hasRole(UPGRADER_ROLE, otherAccount);

      expect(hasUpgraderRole).to.be.false;
    });
  });
  describe("Pause Contract", function () {
    it("Should only Allow the account having PAUSER_ROLE to Pause the Contract", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      const PAUSER_ROLE = await coiin.PAUSER_ROLE();
      await coiin.connect(multiSig).grantRole(PAUSER_ROLE, otherAccount);
      await coiin.connect(otherAccount).pauseWithdrawals(true);
      const isPaused = await coiin.withdrawalsPaused();
      expect(isPaused).to.be.true;
    });
    it("Should not  Allow anyone except PAUSER_ROLE to Pause the Contract ", async function () {
      const { coiin } = await loadFixture(deployCoiinFixture);
      const [
        owner,
        otherAccount,
        signer,
        multiSig,
        mockUser1,
        mockUser2,
        mockUser3,
      ] = await ethers.getSigners();

      const PAUSER_ROLE = await coiin.PAUSER_ROLE();
      await expect(
        coiin.connect(otherAccount).pauseWithdrawals(true)
      ).to.be.rejectedWith(
        `AccessControlUnauthorizedAccount("${otherAccount.address}", "${PAUSER_ROLE}")`
      );
      const isPaused = await coiin.withdrawalsPaused();

      expect(isPaused).to.be.false;
    });
  });
});
