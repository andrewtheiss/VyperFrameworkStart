import ape


def test_initial_state(counter, owner):
    assert counter.owner() == owner.address
    assert counter.count() == 0


def test_increment(counter, alice):
    counter.increment(sender=alice)
    counter.increment(sender=alice)
    assert counter.count() == 2


def test_increment_emits_event(counter, alice):
    receipt = counter.increment(sender=alice)
    logs = list(receipt.decode_logs(counter.Incremented))
    assert len(logs) == 1
    assert logs[0].caller == alice.address
    assert logs[0].new_count == 1


def test_reset_only_owner(counter, owner, alice):
    counter.increment(sender=alice)
    with ape.reverts("not owner"):
        counter.reset(sender=alice)
    counter.reset(sender=owner)
    assert counter.count() == 0
