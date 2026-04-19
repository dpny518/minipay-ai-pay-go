// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  TaskEscrow
 * @notice Two-phase escrow for MiniPay AI Task Router.
 *
 *         User flow:
 *           1. User approves cUSD spend:  cUSD.approve(escrow, amount)
 *           2. User deposits for task:    escrow.deposit(taskId, amount)
 *           3. Backend processes task via AgentCash APIs
 *           4a. Success → operator calls release(taskId) → funds go to treasury
 *           4b. Failure → operator calls refund(taskId)  → funds back to user
 *           5. Safety net: user can call userRefund(taskId) after TASK_EXPIRY
 *
 *         ┌──────────┐   deposit()   ┌──────────────┐
 *         │  MiniPay │ ────────────► │  TaskEscrow  │
 *         │   User   │               │  (this)      │
 *         └──────────┘               │              │
 *                                    │  release() ──┼──► treasury (cUSD)
 *                                    │  refund()  ──┼──► user     (cUSD)
 *                                    └──────────────┘
 *                                         ▲
 *                                    operator (backend hot wallet)
 *
 * Hackathon: Celo MiniPay × AgentCash — Pay-per-use AI Tools
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TaskEscrow is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev cUSD on Celo Mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a
    /// @dev cUSD on Alfajores:    0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
    IERC20 public immutable cUSD;

    /// @dev After this window, user can self-rescue funds without operator
    uint256 public constant TASK_EXPIRY = 10 minutes;

    /// @dev Maximum fee in basis points (30%)
    uint16 public constant MAX_FEE_BPS = 3000;

    // ─────────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The backend hot wallet that calls release() and refund()
    address public operator;

    /// @notice Address that receives cUSD when tasks succeed
    address public feeRecipient;

    /// @notice Platform fee in basis points taken on release (e.g. 1500 = 15%)
    uint16 public feeBps;

    enum TaskStatus { EMPTY, DEPOSITED, RELEASED, REFUNDED }

    struct Task {
        address user;
        uint256 amount;
        uint64  depositedAt;
        TaskStatus status;
    }

    mapping(bytes32 => Task) public tasks;

    // ─────────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────────

    event TaskDeposited(bytes32 indexed taskId, address indexed user, uint256 amount);
    event TaskReleased(bytes32 indexed taskId, address indexed user, uint256 amount, uint256 fee);
    event TaskRefunded(bytes32 indexed taskId, address indexed user, uint256 amount);
    event OperatorChanged(address indexed oldOperator, address indexed newOperator);
    event FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    event FeeBpsChanged(uint16 oldBps, uint16 newBps);

    // ─────────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _cUSD,
        address _operator,
        address _feeRecipient,
        uint16  _feeBps
    ) Ownable(msg.sender) {
        require(_cUSD         != address(0), "TaskEscrow: zero cUSD");
        require(_operator     != address(0), "TaskEscrow: zero operator");
        require(_feeRecipient != address(0), "TaskEscrow: zero feeRecipient");
        require(_feeBps       <= MAX_FEE_BPS, "TaskEscrow: fee too high");

        cUSD         = IERC20(_cUSD);
        operator     = _operator;
        feeRecipient = _feeRecipient;
        feeBps       = _feeBps;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOperator() {
        require(msg.sender == operator, "TaskEscrow: not operator");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  User: Deposit
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit cUSD into escrow for a task.
     * @dev    Caller must have approved this contract for at least `amount` cUSD.
     * @param  taskId  Unique ID generated by frontend: keccak256(user, nonce, type, timestamp)
     * @param  amount  Amount of cUSD to escrow (18 decimals)
     */
    function deposit(bytes32 taskId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        require(tasks[taskId].status == TaskStatus.EMPTY, "TaskEscrow: taskId already used");
        require(amount > 0, "TaskEscrow: zero amount");

        // CEI: update state before external call
        tasks[taskId] = Task({
            user:        msg.sender,
            amount:      amount,
            depositedAt: uint64(block.timestamp),
            status:      TaskStatus.DEPOSITED
        });

        cUSD.safeTransferFrom(msg.sender, address(this), amount);

        emit TaskDeposited(taskId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Operator: Release (task succeeded)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Release escrowed funds to the platform treasury (task succeeded).
     * @dev    Only callable by the operator. A fee is taken; remainder goes to feeRecipient.
     */
    function release(bytes32 taskId)
        external
        nonReentrant
        onlyOperator
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.DEPOSITED, "TaskEscrow: not deposited");

        // Fee is informational for the event; all funds go to feeRecipient (treasury)
        uint256 fee = (t.amount * feeBps) / 10_000;

        // CEI: update state before transfers
        t.status = TaskStatus.RELEASED;

        cUSD.safeTransfer(feeRecipient, t.amount);

        emit TaskReleased(taskId, t.user, t.amount, fee);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Operator: Refund (task failed)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Refund escrowed funds to the user (task failed).
     */
    function refund(bytes32 taskId)
        external
        nonReentrant
        onlyOperator
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.DEPOSITED, "TaskEscrow: not deposited");

        address user   = t.user;
        uint256 amount = t.amount;

        // CEI: update state before transfer
        t.status = TaskStatus.REFUNDED;

        cUSD.safeTransfer(user, amount);

        emit TaskRefunded(taskId, user, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  User: Self-rescue after expiry
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice User-initiated refund after TASK_EXPIRY. Trust backstop if backend crashes.
     */
    function userRefund(bytes32 taskId)
        external
        nonReentrant
    {
        Task storage t = tasks[taskId];
        require(t.status == TaskStatus.DEPOSITED, "TaskEscrow: not deposited");
        require(msg.sender == t.user, "TaskEscrow: not task owner");
        require(
            block.timestamp >= t.depositedAt + TASK_EXPIRY,
            "TaskEscrow: not expired yet"
        );

        uint256 amount = t.amount;
        t.status = TaskStatus.REFUNDED;

        cUSD.safeTransfer(msg.sender, amount);

        emit TaskRefunded(taskId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Owner: Config
    // ─────────────────────────────────────────────────────────────────────────

    function setOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "TaskEscrow: zero operator");
        emit OperatorChanged(operator, _operator);
        operator = _operator;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "TaskEscrow: zero recipient");
        emit FeeRecipientChanged(feeRecipient, _recipient);
        feeRecipient = _recipient;
    }

    function setFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= MAX_FEE_BPS, "TaskEscrow: fee too high");
        emit FeeBpsChanged(feeBps, _bps);
        feeBps = _bps;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    //  View
    // ─────────────────────────────────────────────────────────────────────────

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
}
