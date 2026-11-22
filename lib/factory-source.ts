import "server-only";

// Kindle's own launch factory for Robinhood Chain. Unaudited: get it audited before promoting it widely.
// One call creates a fixed-supply ERC-20, opens a hook-less Uniswap v4 pool (token / native ETH, 1% fee)
// and adds the whole supply as single-sided liquidity owned by this factory. The factory has no way
// to remove liquidity, so the LP is locked forever. Swap fees are split between the creator and Kindle.
export const FACTORY_SOURCE = String.raw`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct ModifyLiquidityParams {
    int24 tickLower;
    int24 tickUpper;
    int256 liquidityDelta;
    bytes32 salt;
}

interface IPoolManager {
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function unlock(bytes calldata data) external returns (bytes memory);
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData)
        external
        returns (int256 callerDelta, int256 feesAccrued);
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
    function take(address currency, address to, uint256 amount) external;
}

contract KindleToken {
    string public name;
    string public symbol;
    string public image;
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    address public immutable creator;
    address public immutable factory;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, string memory image_, address creator_, uint256 supply_) {
        name = name_;
        symbol = symbol_;
        image = image_;
        creator = creator_;
        factory = msg.sender;
        totalSupply = supply_;
        balanceOf[msg.sender] = supply_;
        emit Transfer(address(0), msg.sender, supply_);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        uint256 bal = balanceOf[from];
        require(bal >= amount, "balance");
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}

contract KindleFactory {
    struct Launch {
        address token;
        address creator;
        address feeRecipient;
        uint64 createdAt;
    }

    struct Info {
        address token;
        address creator;
        uint64 createdAt;
        string name;
        string symbol;
        string image;
    }

    IPoolManager public immutable poolManager;
    uint16 public immutable protocolShareBps;
    address public owner;
    address public treasury;
    uint256 public launchFee;

    uint256 public constant MAX_LAUNCH_FEE = 0.01 ether;
    uint256 public constant SUPPLY = 1_000_000_000 ether;
    uint24 public constant POOL_FEE = 10000;
    int24 public constant TICK_SPACING = 200;
    int24 public constant TICK_LOWER = -887200;
    int24 public constant TICK_UPPER = 200200;
    uint160 public constant START_SQRT_PRICE_X96 = 1766182916108972306728800196231251;
    uint128 public constant LIQUIDITY = 44966196545060327333885;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint8 private constant ADD = 1;
    uint8 private constant COLLECT = 2;

    Launch[] private _launches;
    mapping(address => uint256) public indexPlusOne;

    event Launched(address indexed token, address indexed creator, string name, string symbol, string image, bytes32 poolId);
    event FeesCollected(address indexed token, uint256 ethToCreator, uint256 ethToProtocol, uint256 tokensToCreator, uint256 tokensToProtocol);
    event FeeRecipientChanged(address indexed token, address recipient);
    event OwnerChanged(address owner);
    event TreasuryChanged(address treasury);
    event LaunchFeeChanged(uint256 fee);

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    constructor(address poolManager_, address treasury_, uint16 protocolShareBps_) {
        require(poolManager_ != address(0) && treasury_ != address(0), "zero");
        require(protocolShareBps_ <= 5000, "share");
        poolManager = IPoolManager(poolManager_);
        treasury = treasury_;
        protocolShareBps = protocolShareBps_;
        owner = msg.sender;
    }

    function launch(string calldata name_, string calldata symbol_, string calldata image_) external payable returns (address token) {
        require(msg.value == launchFee, "fee");
        uint256 nl = bytes(name_).length;
        uint256 sl = bytes(symbol_).length;
        require(nl > 0 && nl <= 40 && sl > 0 && sl <= 12 && bytes(image_).length <= 300, "metadata");

        token = address(new KindleToken(name_, symbol_, image_, msg.sender, SUPPLY));
        PoolKey memory key = _key(token);
        poolManager.initialize(key, START_SQRT_PRICE_X96);
        poolManager.unlock(abi.encode(ADD, token));

        uint256 left = KindleToken(token).balanceOf(address(this));
        if (left > 0) KindleToken(token).transfer(DEAD, left);

        _launches.push(Launch(token, msg.sender, msg.sender, uint64(block.timestamp)));
        indexPlusOne[token] = _launches.length;

        if (msg.value > 0) {
            (bool ok, ) = treasury.call{value: msg.value}("");
            require(ok, "treasury");
        }
        emit Launched(token, msg.sender, name_, symbol_, image_, keccak256(abi.encode(key)));
    }

    /// Anyone may trigger this; fees always go to the token's fee recipient and the treasury.
    function collectFees(address token) external returns (uint256 eth, uint256 tokens) {
        require(indexPlusOne[token] != 0, "unknown");
        (eth, tokens) = abi.decode(poolManager.unlock(abi.encode(COLLECT, token)), (uint256, uint256));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "pm");
        (uint8 action, address token) = abi.decode(data, (uint8, address));
        PoolKey memory key = _key(token);

        if (action == ADD) {
            (int256 delta, ) = poolManager.modifyLiquidity(
                key,
                ModifyLiquidityParams(TICK_LOWER, TICK_UPPER, int256(uint256(LIQUIDITY)), bytes32(0)),
                ""
            );
            require(int128(delta >> 128) == 0, "range");
            int128 owed = int128(delta);
            if (owed < 0) {
                poolManager.sync(token);
                KindleToken(token).transfer(address(poolManager), uint256(uint128(-owed)));
                poolManager.settle();
            }
            return "";
        }

        return _collect(key, token);
    }

    function _collect(PoolKey memory key, address token) private returns (bytes memory) {
        (int256 fees, ) = poolManager.modifyLiquidity(key, ModifyLiquidityParams(TICK_LOWER, TICK_UPPER, 0, bytes32(0)), "");
        uint256 eth = _positive(int128(fees >> 128));
        uint256 tok = _positive(int128(fees));
        address to = _launches[indexPlusOne[token] - 1].feeRecipient;
        uint256 ethP = (eth * protocolShareBps) / 10000;
        uint256 tokP = (tok * protocolShareBps) / 10000;
        _take(address(0), to, eth - ethP);
        _take(address(0), treasury, ethP);
        _take(token, to, tok - tokP);
        _take(token, treasury, tokP);
        emit FeesCollected(token, eth - ethP, ethP, tok - tokP, tokP);
        return abi.encode(eth, tok);
    }

    function _positive(int128 v) private pure returns (uint256) {
        return v > 0 ? uint256(uint128(v)) : 0;
    }

    function setFeeRecipient(address token, address recipient) external {
        uint256 i = indexPlusOne[token];
        require(i != 0, "unknown");
        Launch storage l = _launches[i - 1];
        require(msg.sender == l.feeRecipient, "recipient");
        require(recipient != address(0), "zero");
        l.feeRecipient = recipient;
        emit FeeRecipientChanged(token, recipient);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "zero");
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    function setLaunchFee(uint256 fee) external onlyOwner {
        require(fee <= MAX_LAUNCH_FEE, "max");
        launchFee = fee;
        emit LaunchFeeChanged(fee);
    }

    function transferOwnership(address owner_) external onlyOwner {
        require(owner_ != address(0), "zero");
        owner = owner_;
        emit OwnerChanged(owner_);
    }

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function launchOf(address token) external view returns (Launch memory) {
        uint256 i = indexPlusOne[token];
        require(i != 0, "unknown");
        return _launches[i - 1];
    }

    /// Newest first.
    function recent(uint256 offset, uint256 count) external view returns (Info[] memory out) {
        uint256 n = _launches.length;
        if (offset >= n) return new Info[](0);
        uint256 m = n - offset;
        if (count < m) m = count;
        out = new Info[](m);
        for (uint256 i = 0; i < m; i++) {
            Launch storage l = _launches[n - 1 - offset - i];
            KindleToken t = KindleToken(l.token);
            out[i] = Info(l.token, l.creator, l.createdAt, t.name(), t.symbol(), t.image());
        }
    }

    function poolKeyOf(address token) external pure returns (PoolKey memory) {
        return _key(token);
    }

    function _key(address token) private pure returns (PoolKey memory) {
        return PoolKey(address(0), token, POOL_FEE, TICK_SPACING, address(0));
    }

    function _take(address currency, address to, uint256 amount) private {
        if (amount > 0) poolManager.take(currency, to, amount);
    }
}
`;
