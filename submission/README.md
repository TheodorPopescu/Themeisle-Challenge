# Prediction Market - Themeisle Internship Submission 2026

**Applicant:** [Theodor Popescu Alexandru] ||
**Email:** [popescutheodor24@stud.ase.ro]

---



## Short Description

In this project, I prioritized **User Experience and Technical Robustness**, transforming the core requirements into a high-engagement, user-friendly trading platform. Key functional enhancements include an integrated Global Search, advanced market sorting, closing times for each market, and real-time notifications (pop-ups) for immediate user feedback. To drive user engagement, I integrated a tier system where players earn dynamic badges based on their total winnings. I also prioritized user-centric risk management by implementing a **'Cash Out'** mechanism. This acts as a **financial safety net**, allowing players to exercise greater control over their capital by retracting or settling wagers before a market is resolved.

On the backend, I implemented a custom Pari-mutuel payout engine and a dynamic 'Estimated Payout' calculator to provide users with full transparency before wagering. To ensure financial integrity, all balance operations are handled via atomic database transactions, guaranteeing that fund deductions and winnings are processed with 100% accuracy and safety.


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

2. UX/UI design:
*   **Dark Mode Support:** Full accessibility support with a toggleable Dark Theme for low-light environments.
*   **Universal Search:** An integrated search bar on the dashboard to quickly find markets by title or keyword.
*   **"How It Works" (About Page):** A comprehensive onboarding guide to explain Pari-mutuel betting and payouts to new users.
*   **Advanced Profile Stats:** Real-time calculation of a user's Win Rate and Total Wagered amount, providing deep insights into their betting performance.
*   **Wallet:** The Wallet is your personal treasury on the platform. Since this is a simulated market, it manages your virtual credits and provides a transparent look at your financial activity, while allowing the **admin** to add balance to his account.
*   **Gamification & Badges:** Dynamic player ranking system (Whale, Shark) based on account winnings to drive user engagement and competition.

3. Closing date and automatic market resolving
The closing date serves as the official deadline for all participation, marking the exact moment the market stops accepting new wagers and locks its final pool. At this cutoff point, the system will choose a winning outcome based on current odds, using a random number generator. The market will resolve and instantly trigger the payout distribution process without the need for manual intervention, providing users with a fast and entirely automated trading experience.

4. Reusable API (Bonus Task)
To complete the bonus task, I followed the hint to reuse existing endpoints. It can now authenticate a request using either a standard JWT Token (from the frontend login) or a persistent API Key (from a user's profile). This keeps the codebase DRY (Don't Repeat Yourself) and ensures that bots and humans are subject to the same validation rules.

---
## Challenges faced during development

1. Maintaining Logic Integrity & Preventing Regression
Maintaining the core logic while scaling the application was a primary technical challenge. I had to implement advanced features without compromising the foundational functionality provided in the initial project structure. By adopting a modular approach, I ensured that new additions, like the Admin resolution controls, remained decoupled from the core betting engine. This allowed for rapid iteration while keeping the application stable and reliable.

2. Designing for Engagement and Accessibility
Creating an interface that is both visually professional and inherently user-friendly required a careful balance of information density. I prioritized a clean Information Hierarchy, using visual cues like dynamic charts and colors to make complex market data easy to interpret at a glance. Focused heavily on the profile section so the user can easily see all bets and necessary information. Enhancements like the Dark Mode toggle and a fully responsive layout were implemented to ensure the platform remains engaging and accessible to all users.

3. Database Evolution for the "Cash-Out" Mechanism
Implementing the "Cash-Out" feature presented a significant architectural challenge. This required altering the database schema to accurately track the full lifecycle of a wager. Beyond simply refunding a balance, I had to ensure that retracted bets were properly transitioned within the database to be reflected in the user's History section. This required a careful update to the betting logic to distinguish between active, resolved, and cashed-out states, providing users with a transparent audit trail of their activity while maintaining 100% data integrity.



Thank you for the opportunity to take on this challenge!

---

## 🎥 Video Demo (Required)

**[Click here to watch the Video Demo](https://www.loom.com/share/79ea036202cc4c27b51aa3ac99d2b9d8)**



In the demo, I walk through the application's core features, including:

*   Dashboard with Real-Time Polling, Pagination, and Sorting (including the "Closing Soon" feature)
*   Creating a New Market with a custom End Date and self-resolve feature
*   Placing a Bet and seeing the "Estimated Payout" and live Chart update
*   The Admin Panel for resolving and archiving markets
*   Player stats and Wallet
*   Cash Out feature
*   The Bonus Task: Generating an API Key and placing a bet with a "bot" script.
