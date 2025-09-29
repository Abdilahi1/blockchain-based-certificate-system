from solcx import compile_standard, install_solc
from web3 import Web3
import json, os, sys

install_solc("0.8.20")

base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(base_dir)
contract_path = os.path.join(project_root, "contracts", "Credentials.sol")
build_path = os.path.join(project_root, "build", "contract.json")

with open(contract_path, "r") as f:
    source = f.read()

compiled_sol = compile_standard({
    "language": "Solidity",
    "sources": {"Credentials.sol": {"content": source}},
    "settings": {
        "optimizer": {"enabled": True, "runs": 200},
        "evmVersion": "istanbul",
        "outputSelection": {"*": {"*": ["abi", "evm.bytecode"]}}
    }
}, solc_version="0.8.20")

abi = compiled_sol["contracts"]["Credentials.sol"]["CredentialRegistry"]["abi"]
bytecode = compiled_sol["contracts"]["Credentials.sol"]["CredentialRegistry"]["evm"]["bytecode"]["object"]

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:7545"))
if not w3.is_connected():
    print("Could not connect to Ganache")
    sys.exit(1)

chain_id = 1337
my_address = "0x7554D2d6B975f1Fc3890098bB1f54fFD24597bC9"
private_key = "0xb07f7b66069e2065055f98c597c2ad72dfa2d6cf6f7aad5c1851a7e70e5e133c"

Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
nonce = w3.eth.get_transaction_count(my_address)

transaction = Contract.constructor().build_transaction({
    "from": my_address,
    "nonce": nonce,
    "gas": 6721975,
    "gasPrice": w3.to_wei("20", "gwei"),
    "chainId": chain_id
})

signed_txn = w3.eth.account.sign_transaction(transaction, private_key=private_key)
tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

print("Contract deployed at:", tx_receipt.contractAddress)

os.makedirs(os.path.dirname(build_path), exist_ok=True)
with open(build_path, "w") as f:
    json.dump({"abi": abi, "address": tx_receipt.contractAddress}, f)

print("ABI + address saved to:", build_path)
