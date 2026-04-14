# Prediction Market - Themeisle Internship Submission 2026

**Applicant:** [Theodor Popescu Alexandru] ||
**Email:** [popescutheodor24@stud.ase.ro]

---

## 🎥 Video Demo (Required)

**[Click here to watch the Video Demo](https://www.loom.com/share/79ea036202cc4c27b51aa3ac99d2b9d8)**


## Short Description

In this project, I tried focusing on User Experience and implementing key features to make the website user-friendly and accessible for everyone. I added several necessary features such as sorting, search bar, player stats, notification pop-ups, cash out option, while maintaining payout logic and safely substracting and adding balance to users.

In the demo, I walk through the application's core features, including:

*   Dashboard with Real-Time Polling, Pagination, and Sorting (including the "Closing Soon" feature)
*   Creating a New Market with a custom End Date and self-resolving feature
*   Placing a Bet and seeing the "Estimated Payout" and live Chart update
*   The Admin Panel for resolving and archiving markets
*   Player stats and Wallet
*   Cash Out feature
*   The Bonus Task: Generating an API Key and placing a bet with a "bot" script.

---

## 🚀 How to Run The Project

This project uses **Bun** and a local **SQLite** database, so no external database setup is required. The `db:reset` command will automatically seed the database with test data.

**Prerequisites:** [Bun](https://bun.sh/) must be installed on your system.

### 1. Backend Setup (Terminal 1)
```bash
# Navigate to the server directory
cd server

# Create the local environment file
cp .env.example .env

# Install dependencies
bun install

# Generate Drizzle schema and apply migrations
bun run db:generate
bun run db:migrate

# Seed the database with test users and markets
bun run db:reset

# Start the dev server
bun run dev
The API will be running on http://localhost:4001.
```
2. Frontend Setup (Terminal 2)
```Bash
# Navigate to the client directory
cd client

# Create the local environment file
cp .env.example .env

# Install dependencies
bun install

# Start the dev server
bun run dev
The UI will be running on http://localhost:3000.
🔑 Test Credentials
The database is seeded with a pre-made Admin account for testing.
Email: admin2@test.com
Password: password123
```
🧠 Architectural & Design Choices
Here is a summary of the key technical decisions I made while building this application:
1. Payout & Odds Calculation: Pari-Mutuel System
I chose a Pari-mutuel (Pool Betting) system, similar to platforms like Polymarket. Instead of the platform acting as a "bookmaker" and taking on financial risk with fixed odds, it simply acts as an escrow agent. When a market is resolved, the funds from the losing pool are distributed proportionally to the winners. This model ensures the platform is always solvent and the odds are dynamically set by the users themselves.
2. Real-Time Updates: Short Polling
To fulfill the requirement for real-time updates on the Dashboard and Profile pages, I implemented a short-polling mechanism (setInterval) that silently fetches fresh data from the API every 4 seconds. This approach is lightweight, stateless, and highly reliable, providing a real-time feel without the added complexity of a WebSocket connection, which I felt would be over-engineering for this specific challenge.
3. Database Safety: Transactions
All critical financial operations, especially placing a bet (handlePlaceBet) and resolving a market (handleResolveMarket), are wrapped in Drizzle ORM transactions. This guarantees that a user's balance is deducted if and only if the bet is successfully inserted into the database. This ACID-compliant approach prevents race conditions and ensures data integrity.
4. Reusable API (Bonus Task)
To complete the bonus task, I followed the hint to reuse existing endpoints. I updated the auth.middleware on the backend to be more flexible. It can now authenticate a request using either a standard JWT Token (from the frontend login) or a persistent API Key (from a user's profile). This keeps the codebase DRY (Don't Repeat Yourself) and ensures that bots and humans are subject to the same validation rules.
5. Usage of AI Tools
As encouraged by the prompt, I leveraged AI tools (VS Code Copilot) as a "pair programmer" to accelerate development. My role was that of the architect and product owner—I made the high-level decisions regarding database schema changes (like adding endDate and role), the payout math, and the overall UI/UX flow, while using the AI to rapidly generate boilerplate code, write Drizzle queries, and build out Shadcn UI components.
Thank you for the opportunity to take on this challenge!
