import dotenv from 'dotenv';
dotenv.config();
console.log("DB URL:", process.env.DATABASE_URL ? "Exists" : "No");
