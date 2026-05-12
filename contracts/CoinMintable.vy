# pragma version ^0.4.0
"""
@title CoinMintable (ERC-20)
@notice Admin-minted ERC-20 with standard transferable tokens. The deployer is
        the admin and can mint tokens to any wallet. Calling lockMinting()
        freezes the supply permanently. Transfers, approvals, and allowances
        follow ERC-20 behavior — tokens are not soulbound.
"""

MAX_RECIPIENTS: constant(uint256) = 1000


# ERC-20 standard events
event Transfer:
    sender:   indexed(address)
    receiver: indexed(address)
    value:    uint256

event Approval:
    owner:   indexed(address)
    spender: indexed(address)
    value:   uint256

# Admin events
event Minted:
    recipient: indexed(address)
    admin:     indexed(address)
    amount:    uint256

event MintingLocked:
    admin: indexed(address)

event AdminTransferred:
    previousAdmin: indexed(address)
    newAdmin:      indexed(address)


# ERC-20 state
name:        public(String[32])
symbol:      public(String[32])
decimals:    public(uint8)
totalSupply: public(uint256)
balanceOf:   public(HashMap[address, uint256])
allowance:   public(HashMap[address, HashMap[address, uint256]])

# Admin + supply lock
admin:         public(address)
mintingLocked: public(bool)

# Enumeration for off-chain indexers
allRecipients: DynArray[address, MAX_RECIPIENTS]
isRecipient:   HashMap[address, bool]


@deploy
def __init__(
    _name: String[32],
    _symbol: String[32],
    _decimals: uint8,
    _supply: uint256,
):
    """
    @notice Constructor matches the canonical Vyper ERC-20 example.
    @param _name      Full token name.
    @param _symbol    Ticker symbol.
    @param _decimals  Decimal places (18 is the ERC-20 convention).
    @param _supply    Initial supply in token units; scaled by 10**_decimals
                      and credited to the deployer. Pass 0 for no pre-mint.
    """
    self.name     = _name
    self.symbol   = _symbol
    self.decimals = _decimals
    self.admin    = msg.sender

    init_supply: uint256 = _supply * 10 ** convert(_decimals, uint256)
    if init_supply > 0:
        self.totalSupply = init_supply
        self.balanceOf[msg.sender] = init_supply
        self.isRecipient[msg.sender] = True
        self.allRecipients.append(msg.sender)
        log Transfer(sender=empty(address), receiver=msg.sender, value=init_supply)


# --- Admin management ------------------------------------------------------

@external
def transferAdmin(_new_admin: address):
    """
    @notice Hand off admin privileges to another address.
    """
    assert msg.sender == self.admin, "not admin"
    assert _new_admin != empty(address), "new admin required"
    log AdminTransferred(previousAdmin=self.admin, newAdmin=_new_admin)
    self.admin = _new_admin


# --- Minting ---------------------------------------------------------------

@external
def mint(_to: address, _amount: uint256):
    """
    @notice Admin-only: mint `_amount` tokens (in raw base units) to `_to`.
    """
    assert msg.sender == self.admin, "only admin can mint"
    assert not self.mintingLocked, "minting locked"
    assert _to != empty(address), "recipient required"

    self.totalSupply += _amount
    self.balanceOf[_to] += _amount

    if not self.isRecipient[_to]:
        self.isRecipient[_to] = True
        self.allRecipients.append(_to)

    log Transfer(sender=empty(address), receiver=_to, value=_amount)
    log Minted(recipient=_to, admin=msg.sender, amount=_amount)


@external
def lockMinting():
    """
    @notice Admin-only: permanently disable minting so supply is immutable.
    """
    assert msg.sender == self.admin, "not admin"
    assert not self.mintingLocked, "already locked"
    self.mintingLocked = True
    log MintingLocked(admin=msg.sender)


# --- ERC-20 transfers ------------------------------------------------------

@external
def transfer(_to: address, _amount: uint256) -> bool:
    assert _to != empty(address), "transfer to zero address"
    balance: uint256 = self.balanceOf[msg.sender]
    assert balance >= _amount, "insufficient balance"
    self.balanceOf[msg.sender] = balance - _amount
    self.balanceOf[_to] += _amount

    if not self.isRecipient[_to]:
        self.isRecipient[_to] = True
        self.allRecipients.append(_to)

    log Transfer(sender=msg.sender, receiver=_to, value=_amount)
    return True


@external
def approve(_spender: address, _amount: uint256) -> bool:
    self.allowance[msg.sender][_spender] = _amount
    log Approval(owner=msg.sender, spender=_spender, value=_amount)
    return True


@external
def transferFrom(_from: address, _to: address, _amount: uint256) -> bool:
    assert _to != empty(address), "transfer to zero address"
    allowed: uint256 = self.allowance[_from][msg.sender]
    assert allowed >= _amount, "insufficient allowance"
    balance: uint256 = self.balanceOf[_from]
    assert balance >= _amount, "insufficient balance"

    self.balanceOf[_from] = balance - _amount
    self.balanceOf[_to] += _amount
    self.allowance[_from][msg.sender] = allowed - _amount

    if not self.isRecipient[_to]:
        self.isRecipient[_to] = True
        self.allRecipients.append(_to)

    log Transfer(sender=_from, receiver=_to, value=_amount)
    return True


# --- Convenience views -----------------------------------------------------

@external
@view
def getAllRecipients() -> DynArray[address, MAX_RECIPIENTS]:
    return self.allRecipients
