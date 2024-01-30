// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;


import "@thirdweb-dev/contracts/base/ERC20Base.sol";
import "./utils/CoiinECDSA.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

contract Coiin is ERC20Base {
    using CoiinECDSA for bytes32;

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
    address public ownerAddr;
    address public multiSigAddr;

    struct withdrawMint {
        address account;
        uint256 timestamp;
        uint256 amount;
    }

    mapping(uint256 => withdrawMint) public withdrawMintHistory;
    uint256[] public withdrawMintNonce;

    constructor(
        address _defaultAdmin,
        string memory _name,
        string memory _symbol)
    ERC20Base(
    _defaultAdmin,
    _name,
    _symbol
    )
    {
        withdrawSigner = msg.sender;
        ownerAddr = msg.sender;
        multiSigAddr = msg.sender; // TODO: get this address

        withdrawMaxLimit = 100_000 * 1e18;
        withdrawMaxPeriod = 86_400; // 24 hrs

        withdrawAccountLimit = 20_000 * 1e18;
        withdrawAccountPeriod = 86_400; // 24 hrs

        withdrawClusterLimit = 33_333 * 1e18;
        withdrawClusterPeriod = 43_200; // 12 hrs
        withdrawClusterSize = 10;

        // Set 0 nonce for testing
        usedNonces[0] = true;

        // TODO: mint 100m coiin to pool address(s)
        _mint(msg.sender, 100_000_000 * 1e18);
    }

    modifier onlyMultiSig {
        require(msg.sender == multiSigAddr, "not multiSig addr");
        _;
    }

    function getWithdrawLimits() public view
    returns (uint256 _withdrawMaxLimit,
        uint256 _withdrawMaxPeriod,
        uint256 _withdrawAccountLimit,
        uint256 _withdrawAccountPeriod,
        uint256 _withdrawClusterLimit,
        uint256 _withdrawClusterPeriod,
        uint256 _withdrawClusterSize) {
        return (withdrawMaxLimit,
            withdrawMaxPeriod,
            withdrawAccountLimit,
            withdrawAccountPeriod,
            withdrawClusterLimit,
            withdrawClusterPeriod,
            withdrawClusterSize);
    }

    function mintTo(address, uint256) public pure override {
        revert("");
    }

    function deposit(uint256 amount) external {
        uint256 fromBalance = balanceOf(msg.sender);
        require(amount < fromBalance, "not enough balance");
        _burn(msg.sender, amount);
    }

    function changeMultiSig(address _multiSigAddr) external onlyMultiSig {
        multiSigAddr = _multiSigAddr;
    }

    function pauseWithdrawals(bool _paused) external onlyMultiSig {
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
    ) external onlyMultiSig {
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
    ) external onlyMultiSig {
        withdrawMaxLimit = _withdrawMaxLimit;
        withdrawMaxPeriod = _withdrawMaxPeriod;
    }

    function setWithdrawAccountLimits(
        uint256 _withdrawAccountLimit,
        uint256 _withdrawAccountPeriod
    ) external onlyMultiSig {
        withdrawAccountLimit = _withdrawAccountLimit;
        withdrawAccountPeriod = _withdrawAccountPeriod;
    }

    function setWithdrawClusterLimits(
        uint256 _withdrawClusterLimit,
        uint256 _withdrawClusterPeriod,
        uint256 _withdrawClusterSize
    ) external onlyMultiSig {
        withdrawClusterLimit = _withdrawClusterLimit;
        withdrawClusterPeriod = _withdrawClusterPeriod;
        withdrawClusterSize = _withdrawClusterSize;
    }

    function withdraw(
        uint256 amount,
        uint256 expires,
        uint256 nonce
//        bytes memory sig
    ) public {
        require(withdrawalsPaused == false, "Contract Paused");
        require(amount != 0, "Minting zero tokens.");
        require(!usedNonces[nonce], "duplicate transaction found, start new request from Coiin");
        require(block.timestamp < expires, "withdraw period expired");
        checkWithdrawLimits(msg.sender, amount);

        usedNonces[nonce] = true;

        // TODO: disabled for testing
        // this recreates the message that was signed on the client
        // bytes32 message = keccak256(abi.encodePacked(msg.sender, amount, expires, nonce, address(this)))
        // .toEthSignedMessageHash();
        // require(message.recover(sig) == withdrawSigner, "request not signed by Coiin");

        // add mint to map
        withdrawMintHistory[nonce].timestamp = block.timestamp;
        withdrawMintHistory[nonce].account = msg.sender;
        withdrawMintHistory[nonce].amount = amount;
        withdrawMintNonce.push(nonce);

        _mint(msg.sender, amount);
    }

    function checkWithdrawLimits(address account, uint256 amount) private {
        require(amount <= withdrawAccountLimit, "exceeded withdraw account limit");

        uint256 totalWithdraw = 0;
        uint256 accWithdraw = 0;
        uint256 clusterWithdraw = 0;
        uint popCnt = 0;

        for (uint i = 0; i < withdrawMintNonce.length; i++) {
            withdrawMint memory mint = withdrawMintHistory[withdrawMintNonce[i]];

            if (mint.timestamp < block.timestamp - withdrawMaxPeriod) {
                popCnt = withdrawMintNonce.length - i;
                break;
            }

            totalWithdraw = totalWithdraw + mint.amount;

            if (i <= withdrawClusterSize && mint.timestamp > block.timestamp - withdrawClusterPeriod) {
                clusterWithdraw = clusterWithdraw + mint.amount;
            }

            if (mint.account == account) {
                accWithdraw = accWithdraw + mint.amount;
            }
        }

        // Pop mints that are older than 24 hours
        if (popCnt > 0) {
            for (uint i = 0; i < popCnt; i++) {
                popWithdrawMint();
            }
        }

        require(totalWithdraw + amount <= withdrawMaxLimit, "exceeded max limit");
        require(accWithdraw + amount <= withdrawAccountLimit, "exceeded withdraw account limit");
        require(clusterWithdraw + amount <= withdrawClusterLimit, "exceeded withdraw cluster limit");
    }

    function popWithdrawMint() private {
        delete withdrawMintHistory[withdrawMintNonce[withdrawMintNonce.length - 1]];
        withdrawMintNonce.pop();
    }
}
