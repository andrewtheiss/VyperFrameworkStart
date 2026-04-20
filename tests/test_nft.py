import ape
import pytest


# --- Fixtures -----------------------------------------------------------------


@pytest.fixture
def bob(accounts):
    return accounts[2]


@pytest.fixture
def graphic(project, owner):
    return owner.deploy(project.NFTGraphic)


@pytest.fixture
def minter(project, owner, graphic):
    # Deployer = admin.
    return owner.deploy(project.NFTMinter, graphic.address)


@pytest.fixture
def minter1155(project, owner, graphic):
    return owner.deploy(project.NFTMinter1155, graphic.address)


IMG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
FMT = "webp"
W, H = 512, 384
ZERO = "0x" + "0" * 40


# --- NFTGraphic template ------------------------------------------------------


def test_graphic_starts_uninitialized(graphic):
    assert graphic.initialized() is False


def test_graphic_cannot_be_initialized_twice(graphic, alice):
    graphic.initialize(IMG, FMT, W, H, "t", "d", alice.address, sender=alice)
    with ape.reverts("already initialized"):
        graphic.initialize(IMG, FMT, W, H, "t", "d", alice.address, sender=alice)


def test_graphic_supports_interfaces(graphic):
    assert graphic.supportsInterface(bytes.fromhex("01ffc9a7")) is True
    assert graphic.supportsInterface(bytes.fromhex("80ac58cd")) is True
    assert graphic.supportsInterface(bytes.fromhex("5b5e139f")) is True
    assert graphic.supportsInterface(bytes.fromhex("deadbeef")) is False


# --- NFTMinter (ERC-721) admin-only -----------------------------------------


def test_721_deployer_is_admin(minter, owner, graphic):
    assert minter.admin() == owner.address
    assert minter.implementation() == graphic.address
    assert minter.totalMinted() == 0


def test_721_admin_mints_to_recipient(minter, project, owner, alice):
    receipt = minter.mint(
        alice.address, IMG, FMT, W, H, "alice", "for alice", sender=owner
    )
    assert minter.hasMinted(alice.address) is True
    assert minter.totalMinted() == 1

    clone = project.NFTGraphic.at(minter.cloneOf(alice.address))
    assert clone.minter() == alice.address
    assert clone.title() == "alice"

    logs = list(receipt.decode_logs(minter.Minted))
    assert len(logs) == 1
    assert logs[0].recipient == alice.address
    assert logs[0].admin == owner.address
    assert logs[0].clone == clone.address
    assert logs[0].totalMinted == 1


def test_721_non_admin_cannot_mint(minter, alice, bob):
    with ape.reverts("only admin can mint"):
        minter.mint(bob.address, IMG, FMT, W, H, "a", "a", sender=alice)


def test_721_cannot_mint_twice_to_same_recipient(minter, owner, alice):
    minter.mint(alice.address, IMG, FMT, W, H, "a", "a", sender=owner)
    with ape.reverts("recipient already minted"):
        minter.mint(alice.address, IMG, FMT, W, H, "b", "b", sender=owner)


def test_721_zero_recipient_rejected(minter, owner):
    with ape.reverts("recipient required"):
        minter.mint(ZERO, IMG, FMT, W, H, "a", "a", sender=owner)


def test_721_get_all_recipients_in_mint_order(minter, owner, alice, bob):
    minter.mint(alice.address, IMG, FMT, W, H, "a", "a", sender=owner)
    minter.mint(bob.address, IMG, FMT, W, H, "b", "b", sender=owner)
    assert list(minter.getAllRecipients()) == [alice.address, bob.address]


def test_721_transfer_admin(minter, owner, alice, bob):
    receipt = minter.transferAdmin(alice.address, sender=owner)
    assert minter.admin() == alice.address
    logs = list(receipt.decode_logs(minter.AdminTransferred))
    assert logs[0].previousAdmin == owner.address
    assert logs[0].newAdmin == alice.address
    # New admin can mint, old admin cannot.
    minter.mint(bob.address, IMG, FMT, W, H, "b", "b", sender=alice)
    with ape.reverts("only admin can mint"):
        minter.mint(owner.address, IMG, FMT, W, H, "x", "x", sender=owner)


def test_721_transfer_admin_requires_admin(minter, alice, bob):
    with ape.reverts("not admin"):
        minter.transferAdmin(bob.address, sender=alice)


def test_721_transfer_admin_rejects_zero(minter, owner):
    with ape.reverts("new admin required"):
        minter.transferAdmin(ZERO, sender=owner)


def test_721_graphic_is_soulbound(minter, project, owner, alice, bob):
    minter.mint(alice.address, IMG, FMT, W, H, "a", "a", sender=owner)
    clone = project.NFTGraphic.at(minter.cloneOf(alice.address))
    with ape.reverts("soulbound: transfers disabled"):
        clone.transferFrom(alice.address, bob.address, 1, sender=alice)
    with ape.reverts("soulbound: approvals disabled"):
        clone.approve(bob.address, 1, sender=alice)


# --- NFTMinter1155 admin-only -----------------------------------------------


def test_1155_deployer_is_admin(minter1155, owner):
    assert minter1155.admin() == owner.address
    assert minter1155.nextTokenId() == 1
    assert minter1155.totalMinted() == 0


def test_1155_admin_mints_multiple_to_same_recipient(minter1155, project, owner, alice):
    minter1155.mint(alice.address, IMG, FMT, W, H, "a#1", "-", sender=owner)
    minter1155.mint(alice.address, IMG, FMT, W, H, "a#2", "-", sender=owner)
    assert list(minter1155.getMintedBy(alice.address)) == [1, 2]
    assert minter1155.totalMinted() == 2


def test_1155_non_admin_cannot_mint(minter1155, alice):
    with ape.reverts("only admin can mint"):
        minter1155.mint(alice.address, IMG, FMT, W, H, "a", "a", sender=alice)


def test_1155_zero_recipient_rejected(minter1155, owner):
    with ape.reverts("recipient required"):
        minter1155.mint(ZERO, IMG, FMT, W, H, "a", "a", sender=owner)


def test_1155_remint_same_image_to_different_recipient(minter1155, project, owner, alice, bob):
    # Admin mints once to alice, then re-mints the same image to bob with a
    # fresh token id — this is the intended "remint to another wallet" flow.
    minter1155.mint(alice.address, IMG, FMT, W, H, "shared art", "first", sender=owner)
    minter1155.mint(bob.address, IMG, FMT, W, H, "shared art", "first", sender=owner)
    a_clone = project.NFTGraphic.at(minter1155.getCloneOf(1))
    b_clone = project.NFTGraphic.at(minter1155.getCloneOf(2))
    assert a_clone.address != b_clone.address  # separate clones
    assert a_clone.minter() == alice.address
    assert b_clone.minter() == bob.address
    assert bytes(a_clone.getImageData()) == bytes(b_clone.getImageData())


def test_1155_recipients_deduped(minter1155, owner, alice, bob):
    minter1155.mint(alice.address, IMG, FMT, W, H, "a", "-", sender=owner)
    minter1155.mint(bob.address, IMG, FMT, W, H, "b", "-", sender=owner)
    minter1155.mint(alice.address, IMG, FMT, W, H, "a2", "-", sender=owner)
    # Alice shouldn't appear twice even though she received two tokens.
    assert list(minter1155.getAllRecipients()) == [alice.address, bob.address]


def test_1155_has_minted(minter1155, owner, alice, bob):
    minter1155.mint(alice.address, IMG, FMT, W, H, "a", "-", sender=owner)
    assert minter1155.hasMinted(alice.address) is True
    assert minter1155.hasMinted(bob.address) is False


def test_1155_transfer_single_event(minter1155, owner, alice):
    receipt = minter1155.mint(alice.address, IMG, FMT, W, H, "x", "y", sender=owner)
    logs = list(receipt.decode_logs(minter1155.TransferSingle))
    assert len(logs) == 1
    assert logs[0].operator == owner.address
    assert logs[0].sender == ZERO
    assert logs[0].receiver == alice.address
    assert logs[0].id == 1
    assert logs[0].value == 1


def test_1155_minted_event(minter1155, owner, alice):
    receipt = minter1155.mint(alice.address, IMG, FMT, W, H, "x", "y", sender=owner)
    logs = list(receipt.decode_logs(minter1155.Minted))
    assert logs[0].recipient == alice.address
    assert logs[0].admin == owner.address
    assert logs[0].tokenId == 1


def test_1155_balance_of_batch(minter1155, owner, alice, bob):
    minter1155.mint(alice.address, IMG, FMT, W, H, "a", "a", sender=owner)
    minter1155.mint(alice.address, IMG, FMT, W, H, "a2", "a2", sender=owner)
    minter1155.mint(bob.address, IMG, FMT, W, H, "b", "b", sender=owner)
    result = list(
        minter1155.balanceOfBatch(
            [alice.address, alice.address, bob.address, bob.address],
            [1, 3, 2, 3],
        )
    )
    assert result == [1, 0, 0, 1]


def test_1155_supports_interfaces(minter1155):
    assert minter1155.supportsInterface(bytes.fromhex("01ffc9a7")) is True
    assert minter1155.supportsInterface(bytes.fromhex("d9b67a26")) is True
    assert minter1155.supportsInterface(bytes.fromhex("0e89341c")) is True


def test_1155_is_soulbound(minter1155, owner, alice, bob):
    minter1155.mint(alice.address, IMG, FMT, W, H, "a", "a", sender=owner)
    with ape.reverts("soulbound: transfers disabled"):
        minter1155.safeTransferFrom(
            alice.address, bob.address, 1, 1, b"", sender=alice
        )
    with ape.reverts("soulbound: approvals disabled"):
        minter1155.setApprovalForAll(bob.address, True, sender=alice)


def test_1155_transfer_admin(minter1155, owner, alice, bob):
    minter1155.transferAdmin(alice.address, sender=owner)
    assert minter1155.admin() == alice.address
    minter1155.mint(bob.address, IMG, FMT, W, H, "b", "b", sender=alice)
    with ape.reverts("only admin can mint"):
        minter1155.mint(owner.address, IMG, FMT, W, H, "x", "x", sender=owner)


def test_1155_rejects_zero_implementation(project, owner):
    with ape.reverts("implementation required"):
        owner.deploy(project.NFTMinter1155, ZERO)
