# 🔗 Blockchain-Based Certificate Verification System

## 📌 Overview
This project is a **blockchain-powered certificate issuance and verification system**. It provides a decentralized platform where academic institutions, organizations, and employers can issue and verify certificates securely. By leveraging blockchain technology, the system ensures **authenticity, immutability, and protection against forgery**.

---

## ✨ Features
- 🔒 **Secure Credential Issuance** – Certificates are stored on the blockchain to prevent tampering.  
- ✅ **Instant Verification** – Employers and institutions can validate credentials in real time.  
- 📜 **Smart Contract (Solidity)** – Handles certificate storage and verification logic.  
- 🖥️ **User-Friendly Web App** – Frontend built with HTML, CSS, and JavaScript.  
- ⚡ **Python Backend (Flask + Web3.py)** – Connects the frontend with the Ethereum blockchain.  
- 🗄️ **SQL Database Integration** – Stores additional certificate metadata.  
- 🧪 **Ganache Integration** – Local blockchain environment for development and testing.  

---

## 🛠️ Tech Stack
- **Blockchain**: Ethereum, Solidity, Ganache  
- **Backend**: Python (Flask, Web3.py)  
- **Frontend**: HTML, CSS, JavaScript  
- **Database**: MySQL / SQL  
- **Other Tools**: JSON, REST APIs  

---

## 📂 Project Structure
Blockchain/
│── App.py # Main backend application
│── contracts/Credentials.sol # Smart contract
│── blockchain_credentials_schema.sql # Database schema
│── ganache_accounts.json # Test accounts for Ganache
│── build/contract.json # Compiled smart contract ABI
│── scripts/
│ ├── deploy.py # Deploy the smart contract
│ ├── interact.py # Interact with the blockchain
│ └── cli.py # Command-line interface
│── static/
│ ├── css/style.css # Stylesheet
│ ├── js/script.js # Frontend logic
│ └── images/ # Icons and assets
│── templates/
│ └── index.html # Frontend UI
│── requirements.txt # Python dependencies


---

## ⚡ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Abdilahi1/blockchain-based-certificate-system.git
cd blockchain-certificate-verification


