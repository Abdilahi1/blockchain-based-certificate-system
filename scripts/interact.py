from web3 import Web3
import json
import time

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:7545"))

with open("build/contract.json", "r") as f:
    data = json.load(f)

abi = data["abi"]
contract_address = data["address"]

contract = w3.eth.contract(address=contract_address, abi=abi)

my_address = "0x7554D2d6B975f1Fc3890098bB1f54fFD24597bC9"
private_key = "0xb07f7b66069e2065055f98c597c2ad72dfa2d6cf6f7aad5c1851a7e70e5e133c"

def issue_credential(owner, ipfs_hash, credential_type):
    nonce = w3.eth.get_transaction_count(my_address)
    txn = contract.functions.issueCredential(
        owner, ipfs_hash, credential_type
    ).build_transaction({
        "from": my_address,
        "nonce": nonce,
        "gas": 2000000,
        "gasPrice": w3.to_wei("20", "gwei")
    })
    signed_txn = w3.eth.account.sign_transaction(txn, private_key=private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    logs = contract.events.CredentialIssued().process_receipt(tx_receipt)
    credential_id = logs[0]['args']['credentialId']
    print(f"✅ Credential issued! ID: {credential_id.hex()}")
    return credential_id

def verify_credential(credential_id):
    owner, issuer, ipfs_hash, credential_type, timestamp = contract.functions.verifyCredential(credential_id).call()
    print("\n🔎 Credential Verification Result:")
    print(f"  Owner: {owner}")
    print(f"  Issuer: {issuer}")
    print(f"  IPFS Hash: {ipfs_hash}")
    print(f"  Type: {credential_type}")
    print(f"  Issued At: {time.ctime(timestamp)}")
    return owner, issuer, ipfs_hash, credential_type, timestamp
