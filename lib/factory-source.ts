import "server-only";

// Kindle's launch factory for Robinhood Chain (v3). Unaudited: get it audited before promoting it widely.
//
// launch(): creates a fixed-supply ERC-20 (1B) paired with ETH or another owner-approved asset (e.g. a tokenized
// stock or a stablecoin). 800M tokens are sold on a constant-product bonding curve with virtual reserves. The buy
// that empties the curve "graduates" the token: the 200M reserved tokens and the pair asset the curve collected open
// a new Uniswap v4 pool at the curve's final price as one full-range position the factory owns and can never remove.
//
// Fees: every trade pays 1% (70% creator, 30% Kindle) plus the creator's optional tax (0-10%, all to the creator).
// After graduation the same total is the pool's LP fee, so no hook is needed. Creator fees sit in escrow on the
// factory: withdraw them any time, or spend them on buybacks; each buyback's tokens unlock linearly over 5 years.
// Launching costs 0.0005 ETH (owner can change it, max 0.01). New launches start with an anti-snipe tax that falls
// from ~99% to 0 over 5 seconds (the creator's own launch-buy is exempt). The graduation pool's tick spacing is
// picked from the previous block hash at graduation, so nobody can create it or set its price in advance.
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

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

interface IPoolManager {
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function unlock(bytes calldata data) external returns (bytes memory);
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params, bytes calldata hookData)
        external
        returns (int256 callerDelta, int256 feesAccrued);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external returns (int256 swapDelta);
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
    function take(address currency, address to, uint256 amount) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract KindleToken {
    string public name;
    string public symbol;
    string public image;
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    address public immutable creator;
    address public immutable factory;
    address public immutable poolManager;
    bool public immutable holderRewards; // fees go to holders instead of the creator
    bool public graduated;

    // Holder rewards: pair-asset fees credited per token held (paid out by the factory).
    uint256 private constant MAG = 2 ** 128;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 public magPerShare;
    uint256 public totalShares;
    mapping(address => int256) private _corr;
    mapping(address => uint256) public rewardsClaimed;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyFactory() {
        require(msg.sender == factory, "factory");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory image_,
        address creator_,
        uint256 supply_,
        address factory_,
        address poolManager_,
        bool holderRewards_
    ) {
        poolManager = poolManager_;
        holderRewards = holderRewards_;
        name = name_;
        symbol = symbol_;
        image = image_;
        creator = creator_;
        factory = factory_;
        totalSupply = supply_;
        balanceOf[factory_] = supply_;
        emit Transfer(address(0), factory_, supply_);
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

    /// Bonding-curve sells: the factory takes back what the seller sells (no approval needed). Only before graduation.
    function curvePull(address from, uint256 amount) external onlyFactory {
        require(!graduated, "graduated");
        _move(from, factory, amount);
    }

    function markGraduated() external onlyFactory {
        graduated = true;
    }

    /// Curve inventory (factory), pool liquidity (PoolManager) and burned tokens don't earn rewards.
    function _excluded(address a) private view returns (bool) {
        return a == factory || a == poolManager || a == DEAD || a == address(0);
    }

    /// Credits pair-asset rewards to current holders. Returns false while fewer than 1 token is held (factory keeps it pending).
    function addRewards(uint256 amount) external onlyFactory returns (bool) {
        if (totalShares < 1 ether) return false;
        magPerShare += (amount * MAG) / totalShares;
        return true;
    }

    /// Unclaimed holder rewards of an account, in the token's pair asset.
    function rewardsOf(address a) public view returns (uint256) {
        if (!holderRewards || _excluded(a)) return 0;
        return uint256(int256(magPerShare * balanceOf[a]) + _corr[a]) / MAG - rewardsClaimed[a];
    }

    function markRewardsClaimed(address a) external onlyFactory returns (uint256 r) {
        r = rewardsOf(a);
        rewardsClaimed[a] += r;
    }

    function _move(address from, address to, uint256 amount) private {
        uint256 bal = balanceOf[from];
        require(bal >= amount, "balance");
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
        if (holderRewards && from != to) {
            int256 m = int256(magPerShare * amount);
            if (!_excluded(from)) {
                totalShares -= amount;
                _corr[from] += m;
            }
            if (!_excluded(to)) {
                totalShares += amount;
                _corr[to] -= m;
            }
        }
        emit Transfer(from, to, amount);
    }
}

/// Holds the token bytecode so the factory itself stays under the contract size limit.
contract KindleTokenDeployer {
    address public immutable factory;
    address public immutable poolManager;

    constructor(address poolManager_) {
        factory = msg.sender;
        poolManager = poolManager_;
    }

    function deploy(string calldata name_, string calldata symbol_, string calldata image_, address creator_, uint256 supply_, bool holders)
        external
        returns (address)
    {
        require(msg.sender == factory, "factory");
        return address(new KindleToken(name_, symbol_, image_, creator_, supply_, factory, poolManager, holders));
    }
}

contract KindleFactory {
    struct Pair {
        bool enabled;
        uint256 graduation; // pair-asset amount the curve collects when it sells out
        uint160 sqrtPriceQuote0; // pool price at graduation when the pair asset is currency0
        uint160 sqrtPriceQuote1; // ... when it is currency1
        uint128 liquidity; // full-range liquidity minted at graduation (slightly under the exact amounts)
    }

    struct Launch {
        address token;
        address creator;
        address feeRecipient;
        address quote; // pair asset, address(0) = ETH
        uint64 createdAt;
        uint16 taxBps;
        uint16 buybackBps;
        bool graduated;
        uint256 sold;
        uint256 raised;
        uint256 creatorFees; // escrow, in the pair asset (holder mode: rewards waiting for the first holders)
        bool holderRewards; // creator share of fees goes to token holders
    }

    struct Tranche {
        uint128 amount;
        uint128 claimed;
        uint64 start;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string image;
        address quote;
        uint16 taxBps;
        uint16 buybackBps;
        bool holderRewards;
        uint256 buyAmount;
        uint256 minTokensOut;
    }

    struct Quote {
        uint256 out;
        uint256 fee;
        uint256 tax;
        uint256 snipe;
        uint256 net;
        uint256 used; // pair asset actually used (the rest is refunded / not pulled)
    }

    struct Info {
        address token;
        address creator;
        address quote;
        uint64 createdAt;
        uint16 taxBps;
        bool graduated;
        uint256 sold;
        uint256 raised;
        uint256 graduation;
        bool holderRewards;
        string name;
        string symbol;
        string image;
    }

    IPoolManager public immutable poolManager;
    KindleTokenDeployer public immutable deployer;
    uint16 public immutable protocolShareBps;
    address public owner;
    address public treasury;
    uint256 public launchFee;

    uint256 public constant MAX_LAUNCH_FEE = 0.01 ether;
    uint256 public constant SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;
    uint256 public constant LP_SUPPLY = 200_000_000 ether;
    uint256 public constant VIRTUAL_TOKENS = 1066666666666666666666666667;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant MAX_TAX_BPS = 1000;
    uint256 public constant SNIPE_WINDOW = 5;
    uint256 public constant VEST_DURATION = 5 * 365 days;
    int24 private constant MAX_TICK = 887272;
    uint160 private constant MIN_SQRT = 4295128740;
    uint160 private constant MAX_SQRT = 1461446703485210103287273052203988822378723970341;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint8 private constant ADD = 1;
    uint8 private constant COLLECT = 2;
    uint8 private constant SWAP = 3;

    mapping(address => Pair) public pairs;
    mapping(address => bool) private _pairUsed;
    address[] private _pairList;
    Launch[] private _launches;
    mapping(address => uint256) public indexPlusOne;
    mapping(address => PoolKey) private _pools;
    mapping(address => Tranche[]) private _tranches;
    mapping(address => uint256) public lockedTokens; // buyback tokens not yet claimed
    mapping(address => uint256) public protocolFees; // per pair asset
    uint256 private _quoteUsed;
    uint256 private _locked = 1;

    event Launched(address indexed token, address indexed creator, address quote, uint16 taxBps, string name, string symbol, string image);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 quoteAmount, uint256 tokens, uint256 sold, uint256 raised);
    event Graduated(address indexed token, uint256 quoteAmount, uint256 tokens, bytes32 poolId);
    event FeesSwept(address indexed token, uint256 quoteToCreator, uint256 quoteToProtocol, uint256 tokensToCreator, uint256 tokensToProtocol);
    event CreatorFeesClaimed(address indexed token, address to, uint256 amount);
    event Buyback(address indexed token, uint256 quoteSpent, uint256 tokensLocked);
    event VestClaimed(address indexed token, address to, uint256 amount);
    event HolderRewardsClaimed(address indexed token, address indexed holder, uint256 amount);
    event PairSet(address indexed asset, bool enabled, uint256 graduation);
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
        launchFee = 0.0005 ether;
        deployer = new KindleTokenDeployer(poolManager_);
        // ETH pair: graduates at 4.2 ETH. ETH (address 0) is always currency0.
        _setPair(address(0), true, 4.2 ether, 546726262810727612002490081201916, 0, 28953770738886498270290);
    }

    receive() external payable {
        require(msg.sender == address(poolManager), "eth");
    }

    // ------------------------------------------------------------------ launch & trade

    function launch(LaunchParams calldata p) external payable nonReentrant returns (address token) {
        require(pairs[p.quote].enabled, "pair");
        require(p.taxBps <= MAX_TAX_BPS && p.buybackBps <= (p.holderRewards ? 0 : 10000), "params");
        uint256 nl = bytes(p.name).length;
        uint256 sl = bytes(p.symbol).length;
        require(nl > 0 && nl <= 40 && sl > 0 && sl <= 12 && bytes(p.image).length <= 300, "metadata");
        require(msg.value == launchFee + (p.quote == address(0) ? p.buyAmount : 0), "value");

        token = deployer.deploy(p.name, p.symbol, p.image, msg.sender, SUPPLY, p.holderRewards);
        Launch storage l = _launches.push();
        l.token = token;
        l.creator = msg.sender;
        l.feeRecipient = msg.sender;
        l.quote = p.quote;
        l.createdAt = uint64(block.timestamp);
        l.taxBps = p.taxBps;
        l.buybackBps = p.buybackBps;
        l.holderRewards = p.holderRewards;
        indexPlusOne[token] = _launches.length;
        _pairUsed[p.quote] = true;
        protocolFees[address(0)] += launchFee;
        emit Launched(token, msg.sender, p.quote, p.taxBps, p.name, p.symbol, p.image);

        if (p.buyAmount > 0) _buy(token, msg.sender, p.buyAmount, p.minTokensOut, true);
    }

    /// Buy on the curve. ETH pairs: send amountIn as value. Other pairs: approve the factory for amountIn first.
    function buy(address token, uint256 amountIn, uint256 minTokensOut) external payable nonReentrant returns (uint256) {
        Launch storage l = _get(token);
        require(msg.value == (l.quote == address(0) ? amountIn : 0), "value");
        return _buy(token, msg.sender, amountIn, minTokensOut, msg.sender == l.creator);
    }

    function sell(address token, uint256 amount, uint256 minOut) external nonReentrant returns (uint256 out) {
        Launch storage l = _get(token);
        require(!l.graduated, "graduated");
        require(amount > 0 && amount <= l.sold, "amount");
        (uint256 gross, uint256 fee, uint256 tax) = _sellMath(l, amount);
        out = gross - fee - tax;
        require(out >= minOut, "slippage");
        l.sold -= amount;
        l.raised -= gross;
        KindleToken(token).curvePull(msg.sender, amount);
        _fees(l, fee, tax);
        emit Trade(token, msg.sender, false, out, amount, l.sold, l.raised);
        _pay(l.quote, msg.sender, out);
    }

    function _buy(address token, address buyer, uint256 amountIn, uint256 minOut, bool exempt) private returns (uint256) {
        Launch storage l = _launches[indexPlusOne[token] - 1];
        require(!l.graduated, "graduated");
        require(amountIn > 0, "amount");
        Quote memory q = _buyMath(l, amountIn, exempt ? 0 : _snipeBps(l));
        require(q.out > 0 && q.out >= minOut, "slippage");

        if (l.quote != address(0)) _pull(l.quote, buyer, q.used);
        l.sold += q.out;
        l.raised += q.net;
        _fees(l, q.fee, q.tax);
        protocolFees[l.quote] += q.snipe;
        KindleToken(token).transfer(buyer, q.out);
        emit Trade(token, buyer, true, q.used, q.out, l.sold, l.raised);

        if (l.sold == CURVE_SUPPLY) _graduate(token, l);
        if (l.quote == address(0) && amountIn > q.used) _pay(address(0), buyer, amountIn - q.used);
        return q.out;
    }

    function _buyMath(Launch storage l, uint256 amountIn, uint256 snipeBps) private view returns (Quote memory q) {
        uint256 cut = FEE_BPS + l.taxBps + snipeBps;
        q.used = amountIn;
        q.fee = (amountIn * FEE_BPS) / 10000;
        q.tax = (amountIn * l.taxBps) / 10000;
        q.snipe = (amountIn * snipeBps) / 10000;
        q.net = amountIn - q.fee - q.tax - q.snipe;
        uint256 v = _virtualQuote(l.quote) + l.raised;
        uint256 t = VIRTUAL_TOKENS - l.sold;
        uint256 remaining = CURVE_SUPPLY - l.sold;
        q.out = (t * q.net) / (v + q.net);
        if (q.out >= remaining) {
            q.out = remaining;
            uint256 netNeeded = (v * remaining + (t - remaining) - 1) / (t - remaining);
            uint256 gross = (netNeeded * 10000 + (10000 - cut) - 1) / (10000 - cut);
            if (gross > amountIn) gross = amountIn;
            q.used = gross;
            q.fee = (gross * FEE_BPS) / 10000;
            q.tax = (gross * l.taxBps) / 10000;
            q.snipe = (gross * snipeBps) / 10000;
            q.net = gross - q.fee - q.tax - q.snipe;
        }
    }

    function _sellMath(Launch storage l, uint256 amount) private view returns (uint256 gross, uint256 fee, uint256 tax) {
        uint256 v = _virtualQuote(l.quote) + l.raised;
        uint256 t = VIRTUAL_TOKENS - l.sold;
        gross = (v * amount) / (t + amount);
        if (gross > l.raised) gross = l.raised;
        fee = (gross * FEE_BPS) / 10000;
        tax = (gross * l.taxBps) / 10000;
    }

    function _virtualQuote(address quote) private view returns (uint256) {
        return (pairs[quote].graduation * (VIRTUAL_TOKENS - CURVE_SUPPLY)) / CURVE_SUPPLY;
    }

    /// Anti-snipe: ~99% falling to 0 over SNIPE_WINDOW seconds, capped so fee + tax + snipe stays under 100%.
    function _snipeBps(Launch storage l) private view returns (uint256) {
        uint256 elapsed = block.timestamp - l.createdAt;
        if (elapsed >= SNIPE_WINDOW) return 0;
        uint256 maxBps = 9990 - FEE_BPS - l.taxBps;
        return (maxBps * (SNIPE_WINDOW - elapsed)) / SNIPE_WINDOW;
    }

    function _fees(Launch storage l, uint256 fee, uint256 tax) private {
        uint256 p = (fee * protocolShareBps) / 10000;
        protocolFees[l.quote] += p;
        _credit(l, fee - p + tax);
    }

    /// Creator share of fees: into the creator's escrow, or (holder mode) to token holders.
    function _credit(Launch storage l, uint256 amount) private {
        l.creatorFees += amount;
        if (l.holderRewards && l.creatorFees > 0 && KindleToken(l.token).addRewards(l.creatorFees)) l.creatorFees = 0;
    }

    // ------------------------------------------------------------------ graduation

    function _graduate(address token, Launch storage l) private {
        l.graduated = true;
        KindleToken(token).markGraduated();
        PoolKey memory key = _openPool(token, l);
        _quoteUsed = 0;
        poolManager.unlock(abi.encode(ADD, token, uint256(0)));
        uint256 used = _quoteUsed;
        require(used <= l.raised, "lp");
        protocolFees[l.quote] += l.raised - used;
        l.raised = 0;
        uint256 left = KindleToken(token).balanceOf(address(this)) - lockedTokens[token];
        if (left > 0) KindleToken(token).transfer(DEAD, left);
        emit Graduated(token, used, LP_SUPPLY - left, keccak256(abi.encode(key)));
    }

    /// New pool, LP fee = 1% + the creator's tax, tick spacing from the previous block hash (unpredictable in advance).
    function _openPool(address token, Launch storage l) private returns (PoolKey memory key) {
        bool quoteFirst = l.quote < token;
        uint160 price = quoteFirst ? pairs[l.quote].sqrtPriceQuote0 : pairs[l.quote].sqrtPriceQuote1;
        uint256 seed = uint256(keccak256(abi.encode(blockhash(block.number - 1), token, block.timestamp)));
        int24 ts = int24(int256(60 + (seed % 16000)));
        key.currency0 = quoteFirst ? l.quote : token;
        key.currency1 = quoteFirst ? token : l.quote;
        key.fee = uint24(10000 + uint256(l.taxBps) * 100);
        for (uint256 i = 0; i < 8; i++) {
            key.tickSpacing = ts;
            try poolManager.initialize(key, price) {
                _pools[token] = key;
                return key;
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
        (uint8 action, address token, uint256 amount) = abi.decode(data, (uint8, address, uint256));
        PoolKey memory key = _pools[token];
        if (action == ADD) {
            _addLiquidity(key, token);
            return "";
        }
        if (action == SWAP) return abi.encode(_swapIn(key, token, amount));
        _collect(key, token);
        return "";
    }

    function _addLiquidity(PoolKey memory key, address token) private {
        address quote = _launches[indexPlusOne[token] - 1].quote;
        (int24 lower, int24 upper) = _ticks(key.tickSpacing);
        (int256 delta, ) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams(lower, upper, int256(uint256(pairs[quote].liquidity)), bytes32(0)),
            ""
        );
        uint256 owed0 = _owed(int128(delta >> 128));
        uint256 owed1 = _owed(int128(delta));
        _quoteUsed = key.currency0 == quote ? owed0 : owed1;
        _settle(key.currency0, owed0);
        _settle(key.currency1, owed1);
    }

    /// Exact-input swap of the pair asset for the token in the token's pool (creator buybacks after graduation).
    function _swapIn(PoolKey memory key, address token, uint256 amountIn) private returns (uint256 out) {
        bool zeroForOne = key.currency1 == token;
        int256 delta = poolManager.swap(key, SwapParams(zeroForOne, -int256(amountIn), zeroForOne ? MIN_SQRT : MAX_SQRT), "");
        int128 d0 = int128(delta >> 128);
        int128 d1 = int128(delta);
        if (zeroForOne) {
            _settle(key.currency0, _owed(d0));
            out = _positive(d1);
            poolManager.take(key.currency1, address(this), out);
        } else {
            _settle(key.currency1, _owed(d1));
            out = _positive(d0);
            poolManager.take(key.currency0, address(this), out);
        }
    }

    function _settle(address currency, uint256 amount) private {
        if (amount == 0) return;
        if (currency == address(0)) {
            poolManager.settle{value: amount}();
        } else {
            poolManager.sync(currency);
            require(IERC20(currency).transfer(address(poolManager), amount), "settle");
            poolManager.settle();
        }
    }

    // ------------------------------------------------------------------ fees, buyback, vesting

    /// After graduation: sweeps the pool's accrued LP fees. Pair-asset fees go to the creator's escrow (and Kindle's
    /// share to the treasury balance); token-side fees are paid out directly. Anyone may call.
    function sweepFees(address token) external nonReentrant {
        require(_get(token).graduated, "not graduated");
        poolManager.unlock(abi.encode(COLLECT, token, uint256(0)));
    }

    function _collect(PoolKey memory key, address token) private {
        Launch storage l = _launches[indexPlusOne[token] - 1];
        (int24 lower, int24 upper) = _ticks(key.tickSpacing);
        (int256 fees, ) = poolManager.modifyLiquidity(key, ModifyLiquidityParams(lower, upper, 0, bytes32(0)), "");
        bool quoteFirst = key.currency0 == l.quote;
        uint256 q = _positive(quoteFirst ? int128(fees >> 128) : int128(fees));
        uint256 t = _positive(quoteFirst ? int128(fees) : int128(fees >> 128));
        // LP fee (pips) = 1% base, of which protocolShareBps goes to Kindle, + the creator's tax (all creator)
        uint256 qP = (q * protocolShareBps) / key.fee;
        uint256 tP = (t * protocolShareBps) / key.fee;
        if (q > 0) poolManager.take(l.quote, address(this), q);
        protocolFees[l.quote] += qP;
        _credit(l, q - qP);
        if (t > tP) poolManager.take(token, l.holderRewards ? DEAD : l.feeRecipient, t - tP);
        if (tP > 0) poolManager.take(token, treasury, tP);
        emit FeesSwept(token, q - qP, qP, t - tP, tP);
    }

    /// Withdraw escrowed creator fees to the fee recipient (buybackBps of it is spent on a buyback first). Anyone may call.
    function claimCreatorFees(address token) external nonReentrant returns (uint256 paid) {
        Launch storage l = _get(token);
        require(!l.holderRewards, "holders");
        uint256 toBuyback = (l.creatorFees * l.buybackBps) / 10000;
        if (toBuyback > 0) _buyback(token, l, toBuyback);
        paid = l.creatorFees;
        l.creatorFees = 0;
        if (paid > 0) {
            _pay(l.quote, l.feeRecipient, paid);
            emit CreatorFeesClaimed(token, l.feeRecipient, paid);
        }
    }

    /// The fee recipient spends escrowed fees on a buyback now. Each buyback's tokens unlock linearly over 5 years.
    function buyback(address token, uint256 amount) external nonReentrant {
        Launch storage l = _get(token);
        require(msg.sender == l.feeRecipient && !l.holderRewards, "recipient");
        require(amount > 0 && amount <= l.creatorFees, "amount");
        _buyback(token, l, amount);
    }

    function _buyback(address token, Launch storage l, uint256 amount) private {
        l.creatorFees -= amount;
        if (!l.graduated) {
            Quote memory q = _buyMath(l, amount, 0);
            if (q.out == 0) {
                l.creatorFees += amount;
                return;
            }
            l.sold += q.out;
            l.raised += q.net;
            _fees(l, q.fee, q.tax);
            l.creatorFees += amount - q.used; // unused part stays in escrow
            _lock(token, q.out);
            emit Trade(token, address(this), true, q.used, q.out, l.sold, l.raised);
            emit Buyback(token, q.used, q.out);
            if (l.sold == CURVE_SUPPLY) _graduate(token, l);
        } else {
            uint256 out = abi.decode(poolManager.unlock(abi.encode(SWAP, token, amount)), (uint256));
            _lock(token, out);
            emit Buyback(token, amount, out);
        }
    }

    function _lock(address token, uint256 amount) private {
        _tranches[token].push(Tranche(uint128(amount), 0, uint64(block.timestamp)));
        lockedTokens[token] += amount;
    }

    function _unlocked(Tranche storage tr) private view returns (uint256) {
        uint256 elapsed = block.timestamp - tr.start;
        if (elapsed >= VEST_DURATION) return tr.amount;
        return (uint256(tr.amount) * elapsed) / VEST_DURATION;
    }

    /// Buyback tokens unlocked and not yet claimed.
    function vested(address token) public view returns (uint256 amount) {
        Tranche[] storage list = _tranches[token];
        for (uint256 i = 0; i < list.length; i++) amount += _unlocked(list[i]) - list[i].claimed;
    }

    /// Sends unlocked buyback tokens to the fee recipient. Anyone may call.
    function claimVested(address token) external nonReentrant returns (uint256 amount) {
        Launch storage l = _get(token);
        Tranche[] storage list = _tranches[token];
        for (uint256 i = 0; i < list.length; i++) {
            uint256 u = _unlocked(list[i]);
            amount += u - list[i].claimed;
            list[i].claimed = uint128(u);
        }
        if (amount == 0) return 0;
        lockedTokens[token] -= amount;
        KindleToken(token).transfer(l.feeRecipient, amount);
        emit VestClaimed(token, l.feeRecipient, amount);
    }

    /// Holder mode: pays the caller's share of fees, in the pair asset. After graduation, sweepFees first.
    function claimRewards(address token) external nonReentrant returns (uint256 amount) {
        Launch storage l = _get(token);
        amount = KindleToken(token).markRewardsClaimed(msg.sender);
        if (amount > 0) {
            _pay(l.quote, msg.sender, amount);
            emit HolderRewardsClaimed(token, msg.sender, amount);
        }
    }

    function withdrawProtocolFees(address asset) external nonReentrant {
        uint256 amount = protocolFees[asset];
        protocolFees[asset] = 0;
        if (amount > 0) _pay(asset, treasury, amount);
    }

    function setFeeRecipient(address token, address recipient) external {
        Launch storage l = _get(token);
        require(msg.sender == l.feeRecipient, "recipient");
        require(recipient != address(0), "zero");
        l.feeRecipient = recipient;
        emit FeeRecipientChanged(token, recipient);
    }

    function setBuybackBps(address token, uint16 bps) external {
        Launch storage l = _get(token);
        require(msg.sender == l.feeRecipient && !l.holderRewards, "recipient");
        require(bps <= 10000, "bps");
        l.buybackBps = bps;
    }

    // ------------------------------------------------------------------ owner

    /// Approve (or disable) a pair asset. graduation, prices and liquidity come from the /factory page's calculator.
    function setPair(address asset, bool enabled, uint256 graduation, uint160 sqrtPriceQuote0, uint160 sqrtPriceQuote1, uint128 liquidity)
        external
        onlyOwner
    {
        _setPair(asset, enabled, graduation, sqrtPriceQuote0, sqrtPriceQuote1, liquidity);
    }

    function _setPair(address asset, bool enabled, uint256 graduation, uint160 sq0, uint160 sq1, uint128 liquidity) private {
        Pair storage old = pairs[asset];
        if (old.graduation == 0) _pairList.push(asset);
        else if (_pairUsed[asset]) {
            // curve parameters are frozen once a launch uses the pair; only enable/disable can change
            require(old.graduation == graduation && old.liquidity == liquidity, "in use");
            require(old.sqrtPriceQuote0 == sq0 && old.sqrtPriceQuote1 == sq1, "in use");
        }
        require(graduation > 0 && liquidity > 0 && sq0 > 0, "pair");
        require(asset == address(0) || sq1 > 0, "pair");
        pairs[asset] = Pair(enabled, graduation, sq0, sq1, liquidity);
        emit PairSet(asset, enabled, graduation);
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

    // ------------------------------------------------------------------ views

    function pairList() external view returns (address[] memory) {
        return _pairList;
    }

    function launchCount() external view returns (uint256) {
        return _launches.length;
    }

    function launchOf(address token) external view returns (Launch memory) {
        return _get(token);
    }

    function trancheCount(address token) external view returns (uint256) {
        return _tranches[token].length;
    }

    function quoteBuy(address token, uint256 amountIn, address buyer) external view returns (Quote memory q) {
        Launch storage l = _get(token);
        if (l.graduated || amountIn == 0) return q;
        return _buyMath(l, amountIn, buyer == l.creator ? 0 : _snipeBps(l));
    }

    function quoteSell(address token, uint256 amount) external view returns (uint256 out, uint256 fee, uint256 tax) {
        Launch storage l = _get(token);
        if (l.graduated || amount == 0 || amount > l.sold) return (0, 0, 0);
        uint256 gross;
        (gross, fee, tax) = _sellMath(l, amount);
        out = gross - fee - tax;
    }

    function snipeTaxBps(address token) external view returns (uint256) {
        return _snipeBps(_get(token));
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

    function _info(Launch storage l) private view returns (Info memory r) {
        KindleToken t = KindleToken(l.token);
        r.token = l.token;
        r.creator = l.creator;
        r.quote = l.quote;
        r.createdAt = l.createdAt;
        r.taxBps = l.taxBps;
        r.graduated = l.graduated;
        r.sold = l.sold;
        r.raised = l.raised;
        r.graduation = pairs[l.quote].graduation;
        r.holderRewards = l.holderRewards;
        r.name = t.name();
        r.symbol = t.symbol();
        r.image = t.image();
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

    function _owed(int128 v) private pure returns (uint256) {
        return v < 0 ? uint256(uint128(-v)) : 0;
    }

    function _positive(int128 v) private pure returns (uint256) {
        return v > 0 ? uint256(uint128(v)) : 0;
    }

    function _pull(address asset, address from, uint256 amount) private {
        uint256 before = IERC20(asset).balanceOf(address(this));
        require(IERC20(asset).transferFrom(from, address(this), amount), "pull");
        require(IERC20(asset).balanceOf(address(this)) - before == amount, "fee-on-transfer");
    }

    function _pay(address asset, address to, uint256 amount) private {
        if (amount == 0) return;
        if (asset == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "send");
        } else {
            require(IERC20(asset).transfer(to, amount), "send");
        }
    }
}
`;
