from ape import accounts, project


def main():
    deployer = accounts.test_accounts[0]
    contract = deployer.deploy(project.Counter)
    print(f"Counter deployed at: {contract.address}")
    return contract
