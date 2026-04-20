# pragma version ^0.4.0
"""
@title NFTMinter1155 (admin-only)
@notice ERC-1155 minter that deploys a fresh NFTGraphic clone per token ID.
        Only the admin can mint; the admin specifies the recipient for each
        mint. Recipients may receive multiple token IDs. Soulbound.
"""

MAX_IMAGE_BYTES:       constant(uint256) = 45000
MAX_TOKENS_PER_WALLET: constant(uint256) = 100
MAX_RECIPIENTS:        constant(uint256) = 1000


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


# --- ERC-1155 standard events ---

event TransferSingle:
    operator: indexed(address)
    sender:   indexed(address)
    receiver: indexed(address)
    id:       uint256
    value:    uint256

event TransferBatch:
    operator: indexed(address)
    sender:   indexed(address)
    receiver: indexed(address)
    ids:      DynArray[uint256, 128]
    values:   DynArray[uint256, 128]

event ApprovalForAll:
    owner:    indexed(address)
    operator: indexed(address)
    approved: bool

event URI:
    value: String[100]
    id:    indexed(uint256)

event Minted:
    recipient: indexed(address)
    tokenId:   indexed(uint256)
    clone:     indexed(address)
    admin:     address
    title:     String[100]

event AdminTransferred:
    previousAdmin: indexed(address)
    newAdmin:      indexed(address)


INTERFACE_ID_ERC165:           constant(bytes4) = 0x01ffc9a7
INTERFACE_ID_ERC1155:          constant(bytes4) = 0xd9b67a26
INTERFACE_ID_ERC1155_METADATA: constant(bytes4) = 0x0e89341c


admin:          public(address)
implementation: public(address)
nextTokenId:    public(uint256)

cloneOfToken: public(HashMap[uint256, address])
ownerOfToken: public(HashMap[uint256, address])
mintedBy:     HashMap[address, DynArray[uint256, MAX_TOKENS_PER_WALLET]]

allRecipients: DynArray[address, MAX_RECIPIENTS]
isRecipient:   HashMap[address, bool]


@deploy
def __init__(_implementation: address):
    assert _implementation != empty(address), "implementation required"
    self.implementation = _implementation
    self.admin = msg.sender
    self.nextTokenId = 1


@external
def transferAdmin(_new_admin: address):
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
) -> uint256:
    """
    @notice Admin-only: mint a fresh soulbound token ID to `_to`.
    @return The newly-minted token ID.
    """
    assert msg.sender == self.admin, "only admin can mint"
    assert _to != empty(address), "recipient required"
    assert len(self.mintedBy[_to]) < MAX_TOKENS_PER_WALLET, "recipient's per-wallet limit reached"

    token_id: uint256 = self.nextTokenId
    self.nextTokenId += 1

    clone: address = create_minimal_proxy_to(self.implementation)
    extcall NFTGraphic(clone).initialize(
        _image_data, _format, _width, _height, _title, _description, _to,
    )

    self.cloneOfToken[token_id] = clone
    self.ownerOfToken[token_id] = _to
    self.mintedBy[_to].append(token_id)

    if not self.isRecipient[_to]:
        self.isRecipient[_to] = True
        self.allRecipients.append(_to)

    log TransferSingle(
        operator=msg.sender,
        sender=empty(address),
        receiver=_to,
        id=token_id,
        value=1,
    )
    log Minted(
        recipient=_to, tokenId=token_id, clone=clone, admin=msg.sender, title=_title,
    )
    return token_id


# --- ERC-1155 views ---

@external
@view
def balanceOf(_account: address, _id: uint256) -> uint256:
    if self.ownerOfToken[_id] == _account:
        return 1
    return 0


@external
@view
def balanceOfBatch(
    _accounts: DynArray[address, 128],
    _ids: DynArray[uint256, 128],
) -> DynArray[uint256, 128]:
    assert len(_accounts) == len(_ids), "length mismatch"
    out: DynArray[uint256, 128] = []
    for i: uint256 in range(len(_accounts), bound=128):
        if self.ownerOfToken[_ids[i]] == _accounts[i]:
            out.append(1)
        else:
            out.append(0)
    return out


@external
@view
def uri(_id: uint256) -> String[80]:
    # Minimal — on-chain consumers read image bytes directly from the clone
    # returned by getCloneOf(_id).
    return ""


@external
@view
def supportsInterface(_interfaceId: bytes4) -> bool:
    return (
        _interfaceId == INTERFACE_ID_ERC165 or
        _interfaceId == INTERFACE_ID_ERC1155 or
        _interfaceId == INTERFACE_ID_ERC1155_METADATA
    )


# --- Convenience views ---

@external
@view
def hasMinted(_recipient: address) -> bool:
    return self.isRecipient[_recipient]


@external
@view
def getCloneOf(_tokenId: uint256) -> address:
    return self.cloneOfToken[_tokenId]


@external
@view
def getMintedBy(_user: address) -> DynArray[uint256, MAX_TOKENS_PER_WALLET]:
    return self.mintedBy[_user]


@external
@view
def getAllRecipients() -> DynArray[address, MAX_RECIPIENTS]:
    return self.allRecipients


@external
@view
def totalMinted() -> uint256:
    return self.nextTokenId - 1


# --- Soulbound: transfers and approvals revert ---

@external
def setApprovalForAll(_operator: address, _approved: bool):
    assert False, "soulbound: approvals disabled"


@external
@view
def isApprovedForAll(_owner: address, _operator: address) -> bool:
    return False


@external
def safeTransferFrom(
    _from: address,
    _to: address,
    _id: uint256,
    _value: uint256,
    _data: Bytes[1024] = b"",
):
    assert False, "soulbound: transfers disabled"


@external
def safeBatchTransferFrom(
    _from: address,
    _to: address,
    _ids: DynArray[uint256, 128],
    _values: DynArray[uint256, 128],
    _data: Bytes[1024] = b"",
):
    assert False, "soulbound: transfers disabled"
