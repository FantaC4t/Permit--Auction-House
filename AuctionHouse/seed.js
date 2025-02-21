const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Permit = require("./models/Permit");
const User = require("./models/User");
const connectDB = require("./db");

const seedDatabase = async () => {
  await connectDB();

  // Sample Permits
  const permits = [
    { name: "Fireworks Emporium", description: "Fireworks for celebrations." },
    { name: "Wood Block Depot", description: "All types of wood blocks." },
    { name: "Redstone Engineer", description: "Redstone components and contraptions." },
    { name: "Armory", description: "Weapons and armor." }
  ];

  await Permit.insertMany(permits);
  console.log("Permits added!");

  // Sample Users
  const hashedPassword = await bcrypt.hash("password123", 10);
  const users = [
    { username: "admin", password: hashedPassword, coins: 100 },
    { username: "player1", password: hashedPassword, coins: 100 }
  ];

  await User.insertMany(users);
  console.log("Users added!");

  process.exit();
};

seedDatabase();
