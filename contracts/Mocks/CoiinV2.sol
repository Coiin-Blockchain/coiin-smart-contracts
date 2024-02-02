// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;
import { ERC20Base } from "@thirdweb-dev/contracts/base/ERC20Base.sol";
// import "./utils/CoiinECDSA.sol";
import { ECDSA as CoiinECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
// Uncomment this line to use console.log
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "hardhat/console.sol";

error Coiin__ContractPaused();
error Coiin__BalanceTooLow();
error Coiin__ZeroAmount();
error Coiin__InvalidNonce();
error Coiin__Expired();
error Coiin__MaxWithdrawAccountLimit();
error Coiin__MaxWithdrawLimit();
error Coiin__MaxWithdrawClusterLimit();
error Coiin__InvalidSignature();
error Coiin__OnlyMultisig();

/// @title Coiin Token Contract
/// @author Coiin 
/// @notice Implements the Coiin BEP20 token 
contract CoiinV2 is UUPSUpgradeable, ERC20PermitUpgradeable, Ownable2StepUpgradeable {
    using CoiinECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bool public withdrawalsPaused;

    uint256 private withdrawMaxLimit;
    uint256 private withdrawMaxPeriod; // Seconds

    uint256 private withdrawAccountLimit;
    uint256 private withdrawAccountPeriod; // Seconds

    uint256 private withdrawClusterLimit;
    uint256 private withdrawClusterPeriod; // Seconds
    uint256 private withdrawClusterSize;

    mapping(uint256 => bool) usedNonces;

    address public withdrawSigner;
    struct WithdrawMint {
        address account;
        uint256 timestamp;
        uint256 amount;
    }

    mapping(uint256 => WithdrawMint) public withdrawMintHistory;
    uint256 private first;
    uint256 private last;

    function initialize(
        address _multiSigAddr,
        address _initialMintTo,
        address _withdrawSigner,
        string memory _name,
        string memory _symbol
    ) external initializer {
        __Ownable2Step_init();
        __ERC20_init(_name, _symbol);
        __ERC20Permit_init(_name);
        withdrawSigner = _withdrawSigner;

        withdrawMaxLimit = 100_000 ether;
        withdrawMaxPeriod = 1 days; // 24 hrs

        withdrawAccountLimit = 20_000 ether;
        withdrawAccountPeriod = 1 days; // 24 hrs

        withdrawClusterLimit = 33_333 ether;
        withdrawClusterPeriod = 12 hours; // 12 hrs
        withdrawClusterSize = 10;

        _mint(_initialMintTo, 100_000_000 ether);
    }
    function deposit(uint256 amount) external {
        if (amount > balanceOf(msg.sender)) revert Coiin__BalanceTooLow();
        _burn(msg.sender, amount);
    }

    function setWithdrawSigner(address _withdrawSigner) external onlyOwner {
        withdrawSigner = _withdrawSigner;
    }

    function pauseWithdrawals(bool _paused) external onlyOwner {
        withdrawalsPaused = _paused;
    }

    function setWithdrawLimits(
        uint256 _withdrawMaxLimit,
        uint256 _withdrawMaxPeriod,
        uint256 _withdrawAccountLimit,
        uint256 _withdrawAccountPeriod,
        uint256 _withdrawClusterLimit,
        uint256 _withdrawClusterPeriod,
        uint256 _withdrawClusterSize
    ) external onlyOwner {
        withdrawMaxLimit = _withdrawMaxLimit;
        withdrawMaxPeriod = _withdrawMaxPeriod;
        withdrawAccountLimit = _withdrawAccountLimit;
        withdrawAccountPeriod = _withdrawAccountPeriod;
        withdrawClusterLimit = _withdrawClusterLimit;
        withdrawClusterPeriod = _withdrawClusterPeriod;
        withdrawClusterSize = _withdrawClusterSize;
    }

    function setWithdrawMaxLimits(
        uint256 _withdrawMaxLimit,
        uint256 _withdrawMaxPeriod
    ) external onlyOwner {
        withdrawMaxLimit = _withdrawMaxLimit;
        withdrawMaxPeriod = _withdrawMaxPeriod;
    }

    function setWithdrawAccountLimits(
        uint256 _withdrawAccountLimit,
        uint256 _withdrawAccountPeriod
    ) external onlyOwner {
        withdrawAccountLimit = _withdrawAccountLimit;
        withdrawAccountPeriod = _withdrawAccountPeriod;
    }

    function setWithdrawClusterLimits(
        uint256 _withdrawClusterLimit,
        uint256 _withdrawClusterPeriod,
        uint256 _withdrawClusterSize
    ) external onlyOwner {
        withdrawClusterLimit = _withdrawClusterLimit;
        withdrawClusterPeriod = _withdrawClusterPeriod;
        withdrawClusterSize = _withdrawClusterSize;
    }

    function getWithdrawLimits() public view
    returns (
        uint256 _withdrawMaxLimit,
        uint256 _withdrawMaxPeriod,
        uint256 _withdrawAccountLimit,
        uint256 _withdrawAccountPeriod,
        uint256 _withdrawClusterLimit,
        uint256 _withdrawClusterPeriod,
        uint256 _withdrawClusterSize
    ){
        return (
            withdrawMaxLimit,
            withdrawMaxPeriod,
            withdrawAccountLimit,
            withdrawAccountPeriod,
            withdrawClusterLimit,
            withdrawClusterPeriod,
            withdrawClusterSize
        );
    }

    function withdraw(
        uint256 amount
) external {
        _mint(msg.sender, amount);
    }
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function checkWithdrawLimits(address account, uint256 amount) private {
        if (amount > withdrawAccountLimit) revert Coiin__MaxWithdrawAccountLimit();

        uint256 totalWithdraw = 0;
        uint256 accWithdraw = 0;
        uint256 clusterWithdraw = 0;
        uint popCnt = 0;

        for (uint i = 0; i < historyLength(); i++) {
            WithdrawMint memory mint = withdrawMintHistory[first + i];

            // if mint is older than period then increment popCnt for deletion
            if (mint.timestamp < block.timestamp - withdrawMaxPeriod) {
                console.log("Mint is older than 24 hours: ", i);
                popCnt += 1;
            } else { // otherwise include mint in calculations
                totalWithdraw = totalWithdraw + mint.amount;
                if (isInCluster(first+i) && mint.timestamp > block.timestamp - withdrawClusterPeriod) {
                    clusterWithdraw = clusterWithdraw + mint.amount;
                }
                if (mint.account == account && mint.timestamp > block.timestamp - withdrawAccountPeriod) {
                    accWithdraw = accWithdraw + mint.amount;
                }
            }
        }
        dequeue(popCnt);

        if (totalWithdraw + amount > withdrawMaxLimit) revert Coiin__MaxWithdrawLimit();
        if (accWithdraw + amount > withdrawAccountLimit) revert Coiin__MaxWithdrawAccountLimit();
        if (clusterWithdraw + amount > withdrawClusterLimit) revert Coiin__MaxWithdrawClusterLimit();
        _mint(msg.sender, amount);
    }
    function isInCluster(uint256 _index) private view returns (bool) {
        if (historyLength() < withdrawClusterSize || _index >= (last-withdrawClusterSize)) {
            return true;
        }
        return false;
    }
    function enqueue(WithdrawMint memory newMint) private {
        withdrawMintHistory[last] = newMint;
        last += 1;
    }

    function dequeue(uint256 _popCnt) private {
        while (_popCnt > 0) {
            console.log("Deleting: ", first);
            delete withdrawMintHistory[first];
            first += 1;
            _popCnt -= 1;
        }
    }
    function historyLength() private view returns (uint256) {
        return last - first;
    }


}
