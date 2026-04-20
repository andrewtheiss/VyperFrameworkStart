# pragma version ^0.4.0
"""
@title NFTGraphic
@notice Clone-friendly ERC-721 single-token NFT that stores an image payload
        on-chain along with its encoded pixel dimensions. Deployed once as an
        implementation, then cloned per-mint via EIP-1167 by NFTMinter (ERC-721)
        or NFTMinter1155 (ERC-1155). Soulbound: transfers and approvals revert.
"""

INTERFACE_ID_ERC165:          constant(bytes4) = 0x01ffc9a7
INTERFACE_ID_ERC721:          constant(bytes4) = 0x80ac58cd
INTERFACE_ID_ERC721_METADATA: constant(bytes4) = 0x5b5e139f

TOKEN_ID:        constant(uint256) = 1
MAX_IMAGE_BYTES: constant(uint256) = 45000

event Transfer:
    sender:   indexed(address)
    receiver: indexed(address)
    tokenId:  indexed(uint256)

event Minted:
    minter: indexed(address)
    title:  String[100]
    bytes_stored: uint256

# ERC-721 metadata
name:   public(String[32])
symbol: public(String[8])

# Initialization guard — a freshly-deployed clone has initialized == False.
initialized: public(bool)

# Image payload and metadata
tokenURI_data:         Bytes[MAX_IMAGE_BYTES]
tokenURI_data_format:  public(String[10])
imageWidth:            public(uint256)
imageHeight:           public(uint256)
title:                 public(String[100])
description:           public(String[400])
minter:                public(address)


@deploy
def __init__():
    # Intentionally empty: the implementation holds no state. State is set
    # per-clone by initialize() after create_minimal_proxy_to().
    pass


@external
def initialize(
    _image_data: Bytes[MAX_IMAGE_BYTES],
    _format: String[10],
    _width: uint256,
    _height: uint256,
    _title: String[100],
    _description: String[400],
    _minter: address,
):
    """
    @notice One-shot initializer invoked by a minter on a fresh clone.
    """
    assert not self.initialized, "already initialized"
    assert _minter != empty(address), "minter required"

    self.initialized          = True
    self.name                 = "NFTGraphic"
    self.symbol               = "NFTG"
    self.tokenURI_data        = _image_data
    self.tokenURI_data_format = _format
    self.imageWidth           = _width
    self.imageHeight          = _height
    self.title                = _title
    self.description          = _description
    self.minter               = _minter

    log Transfer(sender=empty(address), receiver=_minter, tokenId=TOKEN_ID)
    log Minted(minter=_minter, title=_title, bytes_stored=len(_image_data))


# --- ERC-721 views ----------------------------------------------------------

@external
@view
def balanceOf(_owner: address) -> uint256:
    if self.initialized and _owner == self.minter:
        return 1
    return 0


@external
@view
def ownerOf(_tokenId: uint256) -> address:
    assert _tokenId == TOKEN_ID, "nonexistent token"
    assert self.initialized, "not initialized"
    return self.minter


@external
@view
def tokenURI(_tokenId: uint256) -> String[100]:
    assert _tokenId == TOKEN_ID, "nonexistent token"
    # Callers fetch the image bytes directly via getImageData(); richer
    # OpenSea-style metadata can be layered on later if needed.
    return self.title


@external
@view
def getApproved(_tokenId: uint256) -> address:
    return empty(address)


@external
@view
def isApprovedForAll(_owner: address, _operator: address) -> bool:
    return False


@external
@view
def supportsInterface(_interfaceId: bytes4) -> bool:
    return (
        _interfaceId == INTERFACE_ID_ERC165 or
        _interfaceId == INTERFACE_ID_ERC721 or
        _interfaceId == INTERFACE_ID_ERC721_METADATA
    )


# --- Image data access ------------------------------------------------------

@external
@view
def getTokenURIData() -> Bytes[MAX_IMAGE_BYTES]:
    return self.tokenURI_data


@external
@view
def getImageData() -> Bytes[MAX_IMAGE_BYTES]:
    # Alias matching the legacy reference contract.
    return self.tokenURI_data


@external
@view
def getDimensions() -> (uint256, uint256):
    return (self.imageWidth, self.imageHeight)


# --- Soulbound: all mutating ERC-721 entrypoints revert --------------------

@external
def approve(_approved: address, _tokenId: uint256):
    assert False, "soulbound: approvals disabled"


@external
def setApprovalForAll(_operator: address, _approved: bool):
    assert False, "soulbound: approvals disabled"


@external
def transferFrom(_from: address, _to: address, _tokenId: uint256):
    assert False, "soulbound: transfers disabled"


@external
def safeTransferFrom(_from: address, _to: address, _tokenId: uint256, _data: Bytes[1024] = b""):
    assert False, "soulbound: transfers disabled"
