// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;
import { ECDSA as CoiinECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Coiin Token Contract
/// @author Coiin 
/// @notice Implements the Coiin BEP20 token 
contract Coiin is UUPSUpgradeable, ERC20PermitUpgradeable, Ownable2StepUpgradeable {
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

    event Withdraw(address indexed user, uint256 nonce, uint256 amount);

    function initialize(
        address _multiSigAddr,
        address _initialMintTo,
        address _withdrawSigner,
        string memory _name,
        string memory _symbol
    ) external initializer {
        __Ownable2Step_init();
        __Ownable_init(_multiSigAddr);
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
        require(amount <= balanceOf(msg.sender), "Coiin: Balance too low");
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
        uint256 amount,
        uint256 expires,
        uint256 nonce,
        bytes memory sig
    ) external {
        require(!withdrawalsPaused, "Coiin: Contract Paused");
        require(amount > 0, "Coiin: Zero amount");
        require(!usedNonces[nonce], "Coiin: Invalid nonce");
        require(block.timestamp < expires, "Coiin: Expired");
        checkWithdrawLimits(msg.sender, amount);

        usedNonces[nonce] = true;

        bytes32 message = 
            keccak256(abi.encodePacked(msg.sender, amount, expires, nonce, address(this)))
            .toEthSignedMessageHash();
        require(message.recover(sig) == withdrawSigner, "Coiin: Invalid Signature");

        enqueue(WithdrawMint({
            account: msg.sender,
            timestamp: block.timestamp,
            amount: amount
        }));
        _mint(msg.sender, amount);
        emit Withdraw(msg.sender, nonce, amount);   
    }

    function rescue(address _token, uint256 amount) external onlyOwner {
        IERC20(_token).transfer(owner(), amount);
    }
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function checkWithdrawLimits(address account, uint256 amount) private {
        require(amount <= withdrawAccountLimit, "Coiin: Max Withdraw Account Limit");

        uint256 totalWithdraw = 0;
        uint256 accWithdraw = 0;
        uint256 clusterWithdraw = 0;
        uint popCnt = 0;

        for (uint i = 0; i < historyLength(); i++) {
            WithdrawMint memory mint = withdrawMintHistory[first + i];

            if (mint.timestamp < block.timestamp - withdrawMaxPeriod) {
                popCnt += 1;
            } else { 
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

        require(totalWithdraw + amount <= withdrawMaxLimit, "Coiin: Max Withdraw Limit");
        require(accWithdraw + amount <= withdrawAccountLimit, "Coiin: Max Withdraw Account Limit");
        require(clusterWithdraw + amount <= withdrawClusterLimit, "Coiin: Max Withdraw Cluster Limit");
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
            delete withdrawMintHistory[first];
            first += 1;
            _popCnt -= 1;
        }
    }

    function historyLength() private view returns (uint256) {
        return last - first;
    }
}
