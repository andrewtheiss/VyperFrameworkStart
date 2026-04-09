import pytest


@pytest.fixture
def owner(accounts):
    return accounts[0]


@pytest.fixture
def alice(accounts):
    return accounts[1]


@pytest.fixture
def counter(project, owner):
    return owner.deploy(project.Counter)
