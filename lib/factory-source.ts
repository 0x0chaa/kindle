import "server-only";

// Kindle's launch factory for Robinhood Chain (v2: bonding curve). Unaudited: get it audited before promoting it widely.
//
// launch(): creates a fixed-supply ERC-20 (1B). 800M tokens are sold on a constant-product bonding curve with virtual reserves; the last
// buy that empties the curve "graduates" the token: the 200M reserved tokens and the ~4.2 ETH the curve collected
// open a new Uniswap v4 pool (ETH / token, 1%) at the curve's final price and become one full-range position
// that the factory owns and can never remove (locked forever).
//
// Until graduation the token can only move to or from the factory, and the pool doesn't exist yet: its tick spacing
// is picked from the previous block hash at graduation, so nobody can create it or set its price in advance.
// Every trade pays 1% (curve and pool): 70% to the creator, 30% to Kindle. New launches start with an anti-snipe tax
// that falls from 98% to 0 over the first 5 seconds (the creator's own launch-buy is exempt).
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
    bool public tradable;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyFactory() {
        require(msg.sender == factory, "factory");
        _;
    }

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

    /// Bonding-curve sells: the factory takes back what the seller sells. Only before graduation.
    function curvePull(address from, uint256 amount) external onlyFactory {
        require(!tradable, "graduated");
        _move(from, factory, amount);
    }

    function enableTrading() external onlyFactory {
        tradable = true;
    }

    function _move(address from, address to, uint256 amount) private {
        if (!tradable) require(from == factory || to == factory, "not graduated");
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
        bool graduated;
        uint256 sold;
        uint256 realEth;
        uint256 creatorFees;
    }

    struct Info {
        address token;
        address creator;
        uint64 createdAt;
        bool graduated;
        uint256 sold;
        uint256 realEth;
        string name;
        string symbol;
        string image;
    }

    struct Quote {
        uint256 out;
        uint256 fee;
        uint256 snipe;
        uint256 net;
        uint256 refund;
    }

    IPoolManager public immutable poolManager;
    uint16 public immutable protocolShareBps;
    address public owner;
    address public treasury;
    uint256 public launchFee;
    uint256 public protocolFees;

    uint256 public constant MAX_LAUNCH_FEE = 0.01 ether;
    uint256 public constant SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;
    uint256 public constant LP_SUPPLY = 200_000_000 ether;
    uint256 public constant VIRTUAL_ETH = 1.4 ether;
    uint256 public constant VIRTUAL_TOKENS = 1066666666666666666666666667;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant SNIPE_MAX_BPS = 9800;
    uint256 public constant SNIPE_WINDOW = 5;
    uint24 public constant POOL_FEE = 10000;
    int24 private constant MAX_TICK = 887272;
    uint160 public constant GRAD_SQRT_PRICE_X96 = 546726262810727612002490081201916;
    uint128 public constant GRAD_LIQUIDITY = 28953770738886498270290;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint8 private constant ADD = 1;
    uint8 private constant COLLECT = 2;

    Launch[] private _launches;
    mapping(address => uint256) public indexPlusOne;
    mapping(address => PoolKey) private _pools;
    uint256 private _ethUsed;
    uint256 private _locked = 1;

    event Launched(address indexed token, address indexed creator, string name, string symbol, string image);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 eth, uint256 tokens, uint256 sold, uint256 realEth);
    event Graduated(address indexed token, uint256 eth, uint256 tokens, bytes32 poolId);
    event FeesCollected(address indexed token, uint256 ethToCreator, uint256 ethToProtocol, uint256 tokensToCreator, uint256 tokensToProtocol);
    event CreatorFeesClaimed(address indexed token, address to, uint256 eth);
    event FeeRecipientChanged(address indexed token, address recipient);
    event OwnerChanged(address owner);
    event TreasuryChanged(address treasury);
    event LaunchFeeChanged(uint256 fee);

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 1, "reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address poolManager_, address treasury_, uint16 protocolShareBps_) {
        require(poolManager_ != address(0) && treasury_ != address(0), "zero");
        require(protocolShareBps_ <= 5000, "share");
        poolManager = IPoolManager(poolManager_);
        treasury = treasury_;
        protocolShareBps = protocolShareBps_;
        owner = msg.sender;
    }

    receive() external payable {
        require(msg.sender == address(poolManager), "eth");
    }

    // ------------------------------------------------------------------ launch & trade

    /// Create a token. Any ETH above launchFee is the creator's first buy (no anti-snipe tax).
    function launch(string calldata name_, string calldata symbol_, string calldata image_, uint256 minTokensOut)
        external
        payable
        nonReentrant
        returns (address token)
    {
        require(msg.value >= launchFee, "fee");
        uint256 nl = bytes(name_).length;
        uint256 sl = bytes(symbol_).length;
        require(nl > 0 && nl <= 40 && sl > 0 && sl <= 12 && bytes(image_).length <= 300, "metadata");

        token = address(new KindleToken(name_, symbol_, image_, msg.sender, SUPPLY));

        _launches.push(Launch(token, msg.sender, msg.sender, uint64(block.timestamp), false, 0, 0, 0));
        indexPlusOne[token] = _launches.length;
        protocolFees += launchFee;
        emit Launched(token, msg.sender, name_, symbol_, image_);

        uint256 buyEth = msg.value - launchFee;
        if (buyEth > 0) _buy(token, msg.sender, buyEth, minTokensOut, true);
    }

    function buy(address token, uint256 minTokensOut) external payable nonReentrant returns (uint256) {
        Launch storage l = _get(token);
        return _buy(token, msg.sender, msg.value, minTokensOut, msg.sender == l.creator);
    }

    function sell(address token, uint256 amount, uint256 minEthOut) external nonReentrant returns (uint256 ethOut) {
        Launch storage l = _get(token);
        require(!l.graduated, "graduated");
        require(amount > 0 && amount <= l.sold, "amount");
        uint256 gross;
        uint256 fee;
        (ethOut, fee, gross) = _sellMath(l, amount);
        require(ethOut >= minEthOut, "slippage");

        l.sold -= amount;
        l.realEth -= gross;
        _splitFee(l, fee);
        KindleToken(token).curvePull(msg.sender, amount);
        emit Trade(token, msg.sender, false, ethOut, amount, l.sold, l.realEth);
        _send(msg.sender, ethOut);
    }

    function _buy(address token, address buyer, uint256 ethIn, uint256 minOut, bool exempt) private returns (uint256) {
        Launch storage l = _launches[indexPlusOne[token] - 1];
        require(!l.graduated, "graduated");
        require(ethIn > 0, "eth");
        Quote memory q = _buyMath(l, ethIn, exempt ? 0 : _snipeBps(l.createdAt));
        require(q.out > 0 && q.out >= minOut, "slippage");

        l.sold += q.out;
        l.realEth += q.net;
        _splitFee(l, q.fee);
        protocolFees += q.snipe;
        KindleToken(token).transfer(buyer, q.out);
        emit Trade(token, buyer, true, ethIn - q.refund, q.out, l.sold, l.realEth);

        if (l.sold == CURVE_SUPPLY) _graduate(token, l);
        if (q.refund > 0) _send(buyer, q.refund);
        return q.out;
    }

    function _buyMath(Launch storage l, uint256 ethIn, uint256 snipeBps) private view returns (Quote memory q) {
        q.fee = (ethIn * FEE_BPS) / 10000;
        q.snipe = (ethIn * snipeBps) / 10000;
        q.net = ethIn - q.fee - q.snipe;
        uint256 v = VIRTUAL_ETH + l.realEth;
        uint256 t = VIRTUAL_TOKENS - l.sold;
        uint256 remaining = CURVE_SUPPLY - l.sold;
        q.out = (t * q.net) / (v + q.net);
        if (q.out >= remaining) {
            q.out = remaining;
            uint256 netNeeded = (v * remaining + (t - remaining) - 1) / (t - remaining);
            uint256 keep = 10000 - FEE_BPS - snipeBps;
            uint256 gross = (netNeeded * 10000 + keep - 1) / keep;
            if (gross > ethIn) gross = ethIn;
            q.refund = ethIn - gross;
            q.fee = (gross * FEE_BPS) / 10000;
            q.snipe = (gross * snipeBps) / 10000;
            q.net = gross - q.fee - q.snipe;
        }
    }

    function _sellMath(Launch storage l, uint256 amount) private view returns (uint256 ethOut, uint256 fee, uint256 gross) {
        uint256 v = VIRTUAL_ETH + l.realEth;
        uint256 t = VIRTUAL_TOKENS - l.sold;
        gross = (v * amount) / (t + amount);
        if (gross > l.realEth) gross = l.realEth;
        fee = (gross * FEE_BPS) / 10000;
        ethOut = gross - fee;
    }

    function _snipeBps(uint64 createdAt) private view returns (uint256) {
        uint256 elapsed = block.timestamp - createdAt;
        if (elapsed >= SNIPE_WINDOW) return 0;
        return (SNIPE_MAX_BPS * (SNIPE_WINDOW - elapsed)) / SNIPE_WINDOW;
    }

    function _splitFee(Launch storage l, uint256 fee) private {
        uint256 p = (fee * protocolShareBps) / 10000;
        protocolFees += p;
        l.creatorFees += fee - p;
    }

    // ------------------------------------------------------------------ graduation

    function _graduate(address token, Launch storage l) private {
        l.graduated = true;
        _openPool(token);
        KindleToken(token).enableTrading();
        _ethUsed = 0;
        poolManager.unlock(abi.encode(ADD, token));
        uint256 used = _ethUsed;
        uint256 lpEth = l.realEth;
        require(used <= lpEth, "lp");
        protocolFees += lpEth - used;
        l.realEth = 0;
        uint256 left = KindleToken(token).balanceOf(address(this));
        if (left > 0) KindleToken(token).transfer(DEAD, left);
        emit Graduated(token, used, LP_SUPPLY - left, keccak256(abi.encode(_pools[token])));
    }

    /// The pool is created only at graduation, with a tick spacing derived from the previous block hash, so
    /// nobody can create it (or move its price) in advance. If that key is somehow taken, try the next spacing.
    function _openPool(address token) private {
        uint256 seed = uint256(keccak256(abi.encode(blockhash(block.number - 1), token, block.timestamp)));
        int24 ts = int24(int256(60 + (seed % 16000)));
        for (uint256 i = 0; i < 8; i++) {
            PoolKey memory key = PoolKey(address(0), token, POOL_FEE, ts, address(0));
            try poolManager.initialize(key, GRAD_SQRT_PRICE_X96) {
                _pools[token] = key;
                return;
            } catch {
                ts += 1;
            }
        }
        revert("pool");
    }

    function _ticks(int24 ts) private pure returns (int24 lower, int24 upper) {
        upper = (MAX_TICK / ts) * ts;
        lower = -upper;
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "pm");
        (uint8 action, address token) = abi.decode(data, (uint8, address));
        PoolKey memory key = _key(token);
        if (action == ADD) {
            _addLiquidity(key, token);
            return "";
        }
        return _collect(key, token);
    }

    function _addLiquidity(PoolKey memory key, address token) private {
        (int24 lower, int24 upper) = _ticks(key.tickSpacing);
        (int256 delta, ) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams(lower, upper, int256(uint256(GRAD_LIQUIDITY)), bytes32(0)),
            ""
        );
        int128 a0 = int128(delta >> 128);
        int128 a1 = int128(delta);
        if (a0 < 0) {
            uint256 eth = uint256(uint128(-a0));
            _ethUsed = eth;
            poolManager.settle{value: eth}();
        }
        if (a1 < 0) {
            poolManager.sync(token);
            KindleToken(token).transfer(address(poolManager), uint256(uint128(-a1)));
            poolManager.settle();
        }
    }

    // ------------------------------------------------------------------ fees

    /// After graduation: pays the pool's accrued 1% fees to the creator (70%) and the treasury (30%). Anyone may call.
    function collectFees(address token) external nonReentrant returns (uint256 eth, uint256 tokens) {
        Launch storage l = _get(token);
        require(l.graduated, "not graduated");
        (eth, tokens) = abi.decode(poolManager.unlock(abi.encode(COLLECT, token)), (uint256, uint256));
    }

    function _collect(PoolKey memory key, address token) private returns (bytes memory) {
        (int24 lower, int24 upper) = _ticks(key.tickSpacing);
        (int256 fees, ) = poolManager.modifyLiquidity(key, ModifyLiquidityParams(lower, upper, 0, bytes32(0)), "");
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

    /// Before graduation: pays the creator's share of curve fees to the fee recipient. Anyone may call.
    function claimCreatorFees(address token) external nonReentrant returns (uint256 amount) {
        Launch storage l = _get(token);
        amount = l.creatorFees;
        l.creatorFees = 0;
        if (amount > 0) {
            _send(l.feeRecipient, amount);
            emit CreatorFeesClaimed(token, l.feeRecipient, amount);
        }
    }

    function withdrawProtocolFees() external nonReentrant {
        uint256 amount = protocolFees;
        protocolFees = 0;
        if (amount > 0) _send(treasury, amount);
    }

    function setFeeRecipient(address token, address recipient) external {
        Launch storage l = _get(token);
        require(msg.sender == l.feeRecipient, "recipient");
        require(recipient != address(0), "zero");
        l.feeRecipient = recipient;
        emit FeeRecipientChanged(token, recipient);
    }

    // ------------------------------------------------------------------ owner

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

    // ------------------------------------------------------------------ views

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function launchOf(address token) external view returns (Launch memory) {
        return _get(token);
    }

    function quoteBuy(address token, uint256 ethIn, address buyer) external view returns (Quote memory) {
        Launch storage l = _get(token);
        if (l.graduated || ethIn == 0) return Quote(0, 0, 0, 0, ethIn);
        return _buyMath(l, ethIn, buyer == l.creator ? 0 : _snipeBps(l.createdAt));
    }

    function quoteSell(address token, uint256 amount) external view returns (uint256 ethOut, uint256 fee) {
        Launch storage l = _get(token);
        if (l.graduated || amount == 0 || amount > l.sold) return (0, 0);
        (ethOut, fee, ) = _sellMath(l, amount);
    }

    function snipeTaxBps(address token) external view returns (uint256) {
        return _snipeBps(_get(token).createdAt);
    }

    /// Curve price in wei per whole token (1e18 units).
    function curvePrice(address token) external view returns (uint256) {
        Launch storage l = _get(token);
        return ((VIRTUAL_ETH + l.realEth) * 1e18) / (VIRTUAL_TOKENS - l.sold);
    }

    /// Newest first.
    function recent(uint256 offset, uint256 count) external view returns (Info[] memory out) {
        uint256 n = _launches.length;
        if (offset >= n) return new Info[](0);
        uint256 m = n - offset;
        if (count < m) m = count;
        out = new Info[](m);
        for (uint256 i = 0; i < m; i++) {
            out[i] = _info(_launches[n - 1 - offset - i]);
        }
    }

    function _info(Launch storage l) private view returns (Info memory) {
        KindleToken t = KindleToken(l.token);
        return Info(l.token, l.creator, l.createdAt, l.graduated, l.sold, l.realEth, t.name(), t.symbol(), t.image());
    }

    /// The token's Uniswap v4 pool (all zero before graduation).
    function poolKeyOf(address token) external view returns (PoolKey memory) {
        return _pools[token];
    }

    // ------------------------------------------------------------------ internal

    function _get(address token) private view returns (Launch storage) {
        uint256 i = indexPlusOne[token];
        require(i != 0, "unknown");
        return _launches[i - 1];
    }

    function _key(address token) private view returns (PoolKey memory) {
        return _pools[token];
    }

    function _positive(int128 v) private pure returns (uint256) {
        return v > 0 ? uint256(uint128(v)) : 0;
    }

    function _take(address currency, address to, uint256 amount) private {
        if (amount > 0) poolManager.take(currency, to, amount);
    }

    function _send(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "send");
    }
}
`;
