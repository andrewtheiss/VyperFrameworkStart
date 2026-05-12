import ape
import pytest


@pytest.fixture
def bob(accounts):
    return accounts[2]


@pytest.fixture
def coin(project, owner):
    # Zero initial supply for tests that start from an empty state.
    return owner.deploy(project.CoinMintable, "Test Coin", "TST", 18, 0)


ZERO = "0x" + "0" * 40


def test_deployer_is_admin_with_metadata(coin, owner):
    assert coin.admin() == owner.address
    assert coin.name() == "Test Coin"
    assert coin.symbol() == "TST"
    assert coin.decimals() == 18
    assert coin.totalSupply() == 0
    assert coin.mintingLocked() is False


def test_initial_supply_credits_deployer(project, owner):
    # 1,000 tokens with 18 decimals → 1000 * 10**18 raw units.
    coin = owner.deploy(project.CoinMintable, "Pre-mint", "PRE", 18, 1_000)
    expected = 1_000 * 10 ** 18
    assert coin.totalSupply() == expected
    assert coin.balanceOf(owner.address) == expected
    assert list(coin.getAllRecipients()) == [owner.address]


def test_zero_initial_supply(project, owner):
    coin = owner.deploy(project.CoinMintable, "Empty", "E", 6, 0)
    assert coin.totalSupply() == 0
    assert coin.balanceOf(owner.address) == 0
    assert list(coin.getAllRecipients()) == []


def test_custom_decimals(project, owner):
    # Mimic a 6-decimal stablecoin — 1_000_000 tokens.
    coin = owner.deploy(project.CoinMintable, "Stable", "USD", 6, 1_000_000)
    assert coin.decimals() == 6
    assert coin.totalSupply() == 1_000_000 * 10 ** 6


def test_admin_mints_to_recipient(coin, owner, alice):
    receipt = coin.mint(alice.address, 1_000, sender=owner)
    assert coin.balanceOf(alice.address) == 1_000
    assert coin.totalSupply() == 1_000

    logs = list(receipt.decode_logs(coin.Minted))
    assert logs[0].recipient == alice.address
    assert logs[0].admin == owner.address
    assert logs[0].amount == 1_000

    transfers = list(receipt.decode_logs(coin.Transfer))
    assert transfers[0].sender == ZERO
    assert transfers[0].receiver == alice.address
    assert transfers[0].value == 1_000


def test_non_admin_cannot_mint(coin, alice):
    with ape.reverts("only admin can mint"):
        coin.mint(alice.address, 500, sender=alice)


def test_mint_rejects_zero_recipient(coin, owner):
    with ape.reverts("recipient required"):
        coin.mint(ZERO, 100, sender=owner)


def test_lock_minting(coin, owner, alice):
    coin.mint(alice.address, 100, sender=owner)
    coin.lockMinting(sender=owner)
    assert coin.mintingLocked() is True
    with ape.reverts("minting locked"):
        coin.mint(alice.address, 50, sender=owner)


def test_lock_minting_admin_only(coin, alice):
    with ape.reverts("not admin"):
        coin.lockMinting(sender=alice)


def test_lock_minting_once(coin, owner):
    coin.lockMinting(sender=owner)
    with ape.reverts("already locked"):
        coin.lockMinting(sender=owner)


def test_get_all_recipients_dedup(coin, owner, alice, bob):
    coin.mint(alice.address, 100, sender=owner)
    coin.mint(bob.address, 200, sender=owner)
    coin.mint(alice.address, 50, sender=owner)  # same recipient again
    assert list(coin.getAllRecipients()) == [alice.address, bob.address]


def test_transfer_between_users(coin, owner, alice, bob):
    coin.mint(alice.address, 1000, sender=owner)
    coin.transfer(bob.address, 400, sender=alice)
    assert coin.balanceOf(alice.address) == 600
    assert coin.balanceOf(bob.address) == 400
    # Bob becomes a tracked recipient via receiving the transfer.
    assert bob.address in list(coin.getAllRecipients())


def test_transfer_insufficient_balance(coin, owner, alice, bob):
    coin.mint(alice.address, 100, sender=owner)
    with ape.reverts("insufficient balance"):
        coin.transfer(bob.address, 500, sender=alice)


def test_transfer_rejects_zero_address(coin, owner, alice):
    coin.mint(alice.address, 100, sender=owner)
    with ape.reverts("transfer to zero address"):
        coin.transfer(ZERO, 50, sender=alice)


def test_approve_and_transferFrom(coin, owner, alice, bob):
    coin.mint(alice.address, 1000, sender=owner)
    coin.approve(bob.address, 400, sender=alice)
    assert coin.allowance(alice.address, bob.address) == 400
    coin.transferFrom(alice.address, bob.address, 250, sender=bob)
    assert coin.balanceOf(alice.address) == 750
    assert coin.balanceOf(bob.address) == 250
    assert coin.allowance(alice.address, bob.address) == 150


def test_transferFrom_insufficient_allowance(coin, owner, alice, bob):
    coin.mint(alice.address, 1000, sender=owner)
    coin.approve(bob.address, 100, sender=alice)
    with ape.reverts("insufficient allowance"):
        coin.transferFrom(alice.address, bob.address, 500, sender=bob)


def test_transfer_admin(coin, owner, alice, bob):
    receipt = coin.transferAdmin(alice.address, sender=owner)
    assert coin.admin() == alice.address
    logs = list(receipt.decode_logs(coin.AdminTransferred))
    assert logs[0].previousAdmin == owner.address
    assert logs[0].newAdmin == alice.address

    coin.mint(bob.address, 100, sender=alice)
    with ape.reverts("only admin can mint"):
        coin.mint(owner.address, 100, sender=owner)


def test_transfer_admin_requires_admin(coin, alice, bob):
    with ape.reverts("not admin"):
        coin.transferAdmin(bob.address, sender=alice)


def test_transfer_admin_rejects_zero(coin, owner):
    with ape.reverts("new admin required"):
        coin.transferAdmin(ZERO, sender=owner)
