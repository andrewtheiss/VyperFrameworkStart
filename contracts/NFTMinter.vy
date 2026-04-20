# pragma version ^0.4.0
"""
@title NFTMinter (ERC-721, admin-only)
@notice Deploys EIP-1167 minimal proxy clones of an NFTGraphic implementation.
        Only the admin can call mint(); the admin specifies the recipient.
        Each recipient can receive at most one NFT (1-of-1 soulbound).
"""

MAX_IMAGE_BYTES: constant(uint256) = 45000
MAX_RECIPIENTS:  constant(uint256) = 1000


interface NFTGraphic:
    def initialize(
        _image_data: Bytes[MAX_IMAGE_BYTES],
        _format: String[10],
        _width: uint256,
        _height: uint256,
        _title: String[100],
        _description: String[400],
        _minter: address,
    ): nonpayable


event Minted:
    recipient:   indexed(address)
    clone:       indexed(address)
    admin:       indexed(address)
    totalMinted: uint256

event AdminTransferred:
    previousAdmin: indexed(address)
    newAdmin:      indexed(address)


admin:          public(address)
implementation: public(address)
hasMinted:      public(HashMap[address, bool])
cloneOf:        public(HashMap[address, address])
totalMinted:    public(uint256)

# Ordered list of recipients. Enumerable off-chain via getAllRecipients().
allRecipients: DynArray[address, MAX_RECIPIENTS]


@deploy
def __init__(_implementation: address):
    assert _implementation != empty(address), "implementation required"
    self.implementation = _implementation
    self.admin = msg.sender


@external
def transferAdmin(_new_admin: address):
    """
    @notice Hand off admin privileges to another address.
    """
    assert msg.sender == self.admin, "not admin"
    assert _new_admin != empty(address), "new admin required"
    log AdminTransferred(previousAdmin=self.admin, newAdmin=_new_admin)
    self.admin = _new_admin


@external
def mint(
    _to: address,
    _image_data: Bytes[MAX_IMAGE_BYTES],
    _format: String[10],
    _width: uint256,
    _height: uint256,
    _title: String[100],
    _description: String[400],
) -> address:
    """
    @notice Admin-only: mint a 1-of-1 soulbound NFT to `_to`.
    @return The newly-deployed clone address.
    """
    assert msg.sender == self.admin, "only admin can mint"
    assert _to != empty(address), "recipient required"
    assert not self.hasMinted[_to], "recipient already minted"

    clone: address = create_minimal_proxy_to(self.implementation)
    extcall NFTGraphic(clone).initialize(
        _image_data, _format, _width, _height, _title, _description, _to,
    )

    self.hasMinted[_to] = True
    self.cloneOf[_to] = clone
    self.allRecipients.append(_to)
    self.totalMinted += 1

    log Minted(
        recipient=_to, clone=clone, admin=msg.sender, totalMinted=self.totalMinted,
    )
    return clone


@external
@view
def getAllRecipients() -> DynArray[address, MAX_RECIPIENTS]:
    """
    @notice Every wallet that has received a mint, in mint order.
            Bounded to MAX_RECIPIENTS; off-chain indexers can also follow the
            `Minted` event log for unlimited history.
    """
    return self.allRecipients
