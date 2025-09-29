from interact import issue_credential, verify_credential
import time

def menu():
    while True:
        print("\n====== Blockchain Credential CLI ======")
        print("1. Issue Credential")
        print("2. Verify Credential")
        print("3. Exit")
        choice = input("Choose an option: ").strip()

        if choice == "1":
            owner = input("Enter recipient Ethereum address: ").strip()
            ipfs_hash = input("Enter credential IPFS hash or ID: ").strip()
            credential_type = input("Enter type (Diploma/Certificate/Badge/etc.): ").strip()
            try:
                credential_id = issue_credential(owner, ipfs_hash, credential_type)
                print(f"✅ Credential issued! ID: {credential_id.hex()}")
            except Exception as e:
                print(f"❌ Error issuing credential: {e}")

        elif choice == "2":
            credential_id_hex = input("Enter credential ID (hex): ").strip()
            try:
                credential_id = bytes.fromhex(credential_id_hex)
                owner, issuer, ipfs_hash, credential_type, timestamp = verify_credential(credential_id)
                print("\n🔎 Credential Verification Result:")
                print(f"  Owner: {owner}")
                print(f"  Issuer: {issuer}")
                print(f"  Type: {credential_type}")
                print(f"  IPFS Hash: {ipfs_hash}")
                print(f"  Issued At: {time.ctime(timestamp)}")
            except Exception as e:
                print(f"❌ Error verifying credential: {e}")

        elif choice == "3":
            print("Exiting CLI. Goodbye!")
            break

        else:
            print("⚠ Invalid choice. Please enter 1, 2, or 3.")

if __name__ == "__main__":
    menu()
