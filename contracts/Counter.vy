# pragma version ^0.4.0
"""
@title Counter
@notice Minimal example contract used by the starter tests.
"""

owner: public(address)
count: public(uint256)

event Incremented:
    caller: indexed(address)
    new_count: uint256

@deploy
def __init__():
    self.owner = msg.sender

@external
def increment() -> uint256:
    self.count += 1
    log Incremented(caller=msg.sender, new_count=self.count)
    return self.count

@external
def reset():
    assert msg.sender == self.owner, "not owner"
    self.count = 0
